import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConfirmacionEntrega, HitoViaje, ModoDisponibilidadTransporte, ReservaEstado, SolicitudViaje, VerticalKey,
  PLAZO_ACEPTACION_MIN, admiteEspecie, calcularPrecioTransporte, normalizarHitoViaje, resumenCancelacionDe,
} from 'shared';
import {
  AvailabilityStrategy,
  AvailabilityQuery,
  AvailabilityResult,
  CancelacionStrategy,
  PoliticaReembolso,
  ReservaParaPoliticas,
  ReserveParams,
  SeguimientoStrategy,
  SlotHold,
} from '../../core/availability/availability.strategy';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Transporte } from './transporte.schema';
import { configDeServicio, solicitudDesdeParametros } from './transporte-config';
import { TransporteRepository } from './transporte.repository';
import { TransporteCotizadorService } from './transporte-cotizador.service';
import { datosEntregaValidos, solicitudValida } from './transporte.validacion';

const MINUTOS_TTL = 15;
const DISTANCIA_DEFAULT_KM = 10;
const MS_POR_HORA = 60 * 60 * 1000;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

/**
 * Disponibilidad y precio del vertical "Transporte de mascotas".
 *
 * El precio no se calcula aquí: lo resuelve el motor compartido
 * (`calcularPrecioTransporte`), que es el mismo que usa el frontend para
 * enseñar el desglose. Así el resumen del wizard y el cargo de Stripe no pueden
 * discrepar, que es la única forma de cumplir «precio final antes de pagar».
 *
 * Llegan reservas por dos caminos, y los dos acaban en el mismo motor:
 * - **Flujo de cliente por pantallas** (`detalle.solicitud`): el viaje entero
 *   descrito por el cliente. Lo cotiza `TransporteCotizadorService`, con la
 *   ruta calculada en el servidor, igual que en los resultados.
 * - **Asistente de reserva** (parámetros sueltos: `distanciaKm`, `perros`…).
 *
 * Cuando el motor no puede cerrar un precio, la respuesta no es «no
 * disponible» sino «esto va por presupuesto», que es un camino distinto y sigue
 * siendo una venta.
 */
@Injectable()
export class TransporteAvailabilityStrategy implements AvailabilityStrategy, CancelacionStrategy, SeguimientoStrategy {
  readonly vertical = VerticalKey.TRANSPORTE;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    private readonly repo: TransporteRepository,
    private readonly cotizador: TransporteCotizadorService,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const bruta = params.parametrosExtra?.['solicitud'];
    if (bruta === undefined) return this.disponibilidadDelAsistente(servicioId, params);

    const solicitud = await solicitudValida(bruta);
    if (!solicitud || !(await datosEntregaValidos(params.parametrosExtra?.['entrega']))) {
      return { disponible: false, motivo: 'Faltan datos del viaje. Vuelve a describirlo.', metadata: { motivo: 'solicitud_invalida' } };
    }
    return this.disponibilidadDelViaje(servicioId, solicitud);
  }

  /** Flujo de cliente por pantallas: el viaje ya descrito, cotizado con la ruta del servidor. */
  private async disponibilidadDelViaje(servicioId: string, solicitud: SolicitudViaje): Promise<AvailabilityResult> {
    const empresa = await this.repo.porId(servicioId);
    if (!empresa) throw new DomainException('Servicio de transporte no encontrado', 404);

    const { cotizacion, ruta } = await this.cotizador.cotizarReserva(empresa, solicitud);
    if (cotizacion.estado === 'no_disponible') {
      return { disponible: false, motivo: cotizacion.motivo, metadata: { motivo: 'no_disponible' } };
    }

    const presupuesto = cotizacion.estado === 'presupuesto';
    return {
      disponible: true,
      capacidadRestante: empresa.unidadesDisponibles,
      precioCalculado: cotizacion.total,
      motivo: presupuesto ? cotizacion.motivo : undefined,
      // Sin `duracionMin` a propósito: con él el core trataría el viaje como
      // una cita y lo encajaría en el horario de oficina del transportista.
      metadata: {
        perros: solicitud.mascotas.length,
        requierePresupuesto: presupuesto,
        motivoPresupuesto: presupuesto ? cotizacion.motivo : undefined,
        requiereAceptacion: cotizacion.requiereAceptacion,
        plazoAceptacionMin: cotizacion.plazoAceptacionMin,
        // Queda en `reserva.detalle`: el cliente ve su desglose y el mapa del
        // seguimiento sabe de dónde sale y adónde va el viaje.
        detalleReserva: {
          desglose: cotizacion.desglose,
          ruta: ruta ? {
            km: ruta.trayecto.km,
            duracionMin: ruta.trayecto.duracionMin,
            origen: ruta.origen ? { lat: ruta.origen.lat, lng: ruta.origen.lng } : undefined,
            destino: ruta.destino ? { lat: ruta.destino.lat, lng: ruta.destino.lng } : undefined,
          } : undefined,
        },
      },
    };
  }

  /** Asistente de reserva: los parámetros sueltos que manda el paso de transporte. */
  private async disponibilidadDelAsistente(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const transporte = await this.servicioModel.findById(servicioId).lean().exec() as (Transporte & { _id: unknown }) | null;

    if (!transporte) {
      throw new DomainException('Servicio de transporte no encontrado', 404);
    }

    if ((transporte.unidadesDisponibles ?? 0) <= 0) {
      return { disponible: false, motivo: 'Este transportista no tiene vehículos libres ahora mismo.' };
    }

    const config = configDeServicio(transporte);
    const solicitud = solicitudDesdeParametros(params, DISTANCIA_DEFAULT_KM);

    const impedimento = this.motivoParaRechazar(transporte, config, solicitud, params);
    if (impedimento) return impedimento;

    if (solicitud.distanciaKm <= 0) {
      throw new DomainException('La distancia del trayecto debe ser mayor que 0', 400);
    }

    const desglose = calcularPrecioTransporte(config, solicitud);
    const requiereConfirmacion = this.requiereConfirmacion(config, params);

    const metadata = {
      distanciaKm: desglose.distanciaKm,
      kmFacturables: desglose.kmFacturables,
      tipoVehiculo: transporte.tipoVehiculo,
      capacidadPerros: transporte.capacidadPerros,
      perros: solicitud.mascotas,
      desglose: desglose.lineas,
      reglaAplicada: desglose.reglaAplicada,
      requiereConfirmacion,
      // El core lo convierte en una aceptación con plazo: si la empresa no la
      // confirma a tiempo, se cancela y se devuelve el dinero.
      requiereAceptacion: requiereConfirmacion,
      plazoAceptacionMin: config.confirmacionHoras > 0 ? config.confirmacionHoras * 60 : PLAZO_ACEPTACION_MIN.normal,
      /*
       * `exclusivo` y `extras` son los nombres con los que el cliente antiguo
       * leía el desglose. Se mantienen junto a `desglose`, que es el que lo
       * cuenta entero, para no romper a quien todavía los lea.
       */
      exclusivo: solicitud.suplementosPedidos?.includes('servicio_exclusivo') ?? false,
      extras: desglose.suplementos,
      ...(solicitud.idaVuelta
        ? { tipoTrayecto: 'ida_vuelta', esperaMinutos: solicitud.esperaMinutos }
        : {}),
    };

    if (desglose.requierePresupuesto) {
      /*
       * Sigue estando disponible: lo que no hay es precio cerrado. Marcarlo
       * como no disponible mandaría al cliente de vuelta al listado cuando lo
       * que toca es ofrecerle pedir presupuesto sin rellenar nada otra vez.
       */
      return {
        disponible: true,
        capacidadRestante: transporte.unidadesDisponibles,
        precioCalculado: 0,
        motivo: desglose.motivoPresupuesto,
        metadata: { ...metadata, requierePresupuesto: true, motivoPresupuesto: desglose.motivoPresupuesto },
      };
    }

    return {
      disponible: true,
      capacidadRestante: transporte.unidadesDisponibles,
      precioCalculado: desglose.total,
      metadata: { ...metadata, requierePresupuesto: false },
    };
  }

  /**
   * Razones por las que este viaje no se puede hacer con este transportista.
   *
   * Cada una lleva su explicación: «no disponible» a secas obliga al cliente a
   * probar combinaciones hasta adivinar qué sobraba.
   */
  private motivoParaRechazar(
    transporte: Transporte,
    config: ReturnType<typeof configDeServicio>,
    solicitud: ReturnType<typeof solicitudDesdeParametros>,
    params: AvailabilityQuery,
  ): AvailabilityResult | null {
    const maximo = config.maxMascotasPorReserva || transporte.capacidadPerros;
    if (solicitud.mascotas > maximo) {
      return {
        disponible: false,
        motivo: `Este servicio admite como máximo ${maximo} mascota(s) por trayecto.`,
        metadata: { motivo: 'capacidad_insuficiente', capacidadPerros: maximo, perros: solicitud.mascotas },
      };
    }

    const especie = params.parametrosExtra?.['especie'];
    if (!admiteEspecie(config.especiesAdmitidas, especie)) {
      return {
        disponible: false,
        motivo: 'Este transportista no lleva esta especie.',
        metadata: { motivo: 'especie_no_admitida', especiesAdmitidas: config.especiesAdmitidas },
      };
    }

    if (solicitud.pasajeros > config.plazasAcompanantes) {
      return {
        disponible: false,
        motivo: config.plazasAcompanantes === 0
          ? 'En este servicio viaja sola la mascota, sin acompañantes.'
          : `Este vehículo admite ${config.plazasAcompanantes} acompañante(s).`,
        metadata: { motivo: 'sin_plazas_acompanante', plazasAcompanantes: config.plazasAcompanantes },
      };
    }

    const horasHasta = (params.fechaInicio.getTime() - Date.now()) / MS_POR_HORA;
    // La antelación solo se exige a quien trabaja con calendario: un servicio
    // bajo demanda o urgente existe precisamente para el aviso de última hora.
    const exigeAntelacion = config.modoDisponibilidad === ModoDisponibilidadTransporte.CALENDARIO
      || config.modoDisponibilidad === ModoDisponibilidadTransporte.SALIDAS_PROGRAMADAS;
    if (exigeAntelacion && config.antelacionMinimaHoras > 0 && horasHasta < config.antelacionMinimaHoras) {
      return {
        disponible: false,
        motivo: `Este transportista necesita al menos ${config.antelacionMinimaHoras} h de antelación.`,
        metadata: { motivo: 'antelacion_insuficiente', antelacionMinimaHoras: config.antelacionMinimaHoras },
      };
    }

    return null;
  }

  /**
   * ¿Tiene que mirarlo la empresa antes de aceptar?
   *
   * No bloquea la reserva: la deja pendiente de confirmación. Es lo que pide
   * quien transporta un animal medicado o reactivo, y lo que evita que un
   * conductor se encuentre en la puerta con un caso que no puede atender.
   */
  private requiereConfirmacion(
    config: ReturnType<typeof configDeServicio>,
    params: AvailabilityQuery,
  ): boolean {
    if (config.confirmacionHoras > 0) return true;
    const situaciones = params.parametrosExtra?.['necesidades'];
    if (!Array.isArray(situaciones)) return false;
    return situaciones.some((s) => typeof s === 'string' && config.situacionesConfirmacion.includes(s));
  }

  /**
   * Cuánto se devuelve al cancelar, según la política del alta: todo hasta X
   * horas antes de la recogida, el porcentaje tardío después, y nada con el
   * viaje ya empezado.
   */
  async politicaReembolso(reserva: ReservaParaPoliticas, ahora = new Date()): Promise<PoliticaReembolso> {
    if (reserva.estado === ReservaEstado.EN_CURSO || reserva.seguimiento?.length) {
      return { porcentaje: 0, motivo: 'El viaje ya ha empezado.' };
    }
    const empresa = await this.repo.porId(reserva.servicioId);
    const politica = resumenCancelacionDe(configDeServicio(empresa ?? {}));
    const horasAntes = (reserva.fechaInicio.getTime() - ahora.getTime()) / MS_POR_HORA;

    if (politica.gratisHastaHoras > 0 && horasAntes >= politica.gratisHastaHoras) {
      return { porcentaje: 100, motivo: `Cancelación gratuita hasta ${politica.gratisHastaHoras} h antes.` };
    }
    return {
      porcentaje: politica.reembolsoTardioPct,
      motivo: politica.gratisHastaHoras > 0
        ? `Menos de ${politica.gratisHastaHoras} h antes: se devuelve el ${politica.reembolsoTardioPct} %.`
        : 'Tarifa no reembolsable.',
    };
  }

  /** La entrega necesita foto si el cliente la pidió al reservar. */
  validarHito(reserva: ReservaParaPoliticas, hito: string, fotoUrl?: string): void {
    const conocido = normalizarHitoViaje(hito);
    if (!(Object.values(HitoViaje) as string[]).includes(conocido)) {
      throw new DomainException('Ese paso del viaje no existe.', 400);
    }
    const entrega = reserva.detalle?.['entrega'] as { confirmacionEntrega?: string } | undefined;
    if (conocido === HitoViaje.ENTREGADA && entrega?.confirmacionEntrega === ConfirmacionEntrega.NOTIFICACION_Y_FOTO && !fotoUrl) {
      throw new DomainException('El cliente pidió una foto de la entrega: adjúntala para marcarla.', 400);
    }
  }

  async reserveSlot(servicioId: string, _params: ReserveParams): Promise<SlotHold> {
    const holdId = `hold-${servicioId}-${Date.now()}`;
    const expiraEn = new Date(Date.now() + MINUTOS_TTL * 60 * 1000);
    this.holds.set(holdId, { holdId, servicioId, expiraEn });
    return { holdId, servicioId, expiraEn };
  }

  async releaseSlot(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }
}
