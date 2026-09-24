import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConfirmacionEntrega, HitoViaje, ReservaEstado, SolicitudTransporte, VerticalKey, normalizarHitoViaje,
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
import { TransporteCotizable, TransporteRepository } from './transporte.repository';
import { TransporteCotizadorService } from './transporte-cotizador.service';
import { cancelacionDe } from './transporte.tarifario';
import { datosEntregaValidos, solicitudValida } from './transporte.validacion';

const MINUTOS_TTL = 15;
const DISTANCIA_DEFAULT_KM = 10;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

/**
 * Estrategia de disponibilidad/precio del vertical Transporte de animales.
 *
 * Dos caminos:
 * - **Flujo de cliente nuevo** (`detalle.solicitud`): el precio lo calcula
 *   `TransporteCotizadorService` con la ruta del servidor, igual que en
 *   resultados. Es el único camino que usa la web desde el flujo por pantallas.
 * - **Asistente antiguo** (`detalle.distanciaKm`): base + km por trayecto. Se
 *   mantiene para reservas que llegan desde el carrito o desde clientes viejos.
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
    if (bruta === undefined) return this.disponibilidadAntigua(servicioId, params);

    const solicitud = await solicitudValida(bruta);
    if (!solicitud || !(await datosEntregaValidos(params.parametrosExtra?.['entrega']))) {
      return { disponible: false, motivo: 'Faltan datos del viaje. Vuelve a describirlo.', metadata: { motivo: 'solicitud_invalida' } };
    }
    return this.disponibilidadDeSolicitud(servicioId, solicitud, params);
  }

  private async disponibilidadDeSolicitud(
    servicioId: string,
    solicitud: SolicitudTransporte,
    params: AvailabilityQuery,
  ): Promise<AvailabilityResult> {
    const empresa = await this.repo.porId(servicioId);
    if (!empresa) throw new DomainException('Servicio de transporte no encontrado', 404);

    const { cotizacion, ruta } = await this.cotizador.cotizarReserva(empresa, solicitud);
    const precioAcordado = Number(params.parametrosExtra?.['precioAcordado']);
    const conPresupuesto = Number.isFinite(precioAcordado) && precioAcordado > 0;

    if (cotizacion.estado === 'no_disponible') {
      return { disponible: false, motivo: cotizacion.motivo, metadata: { motivo: 'no_disponible' } };
    }
    if (cotizacion.estado === 'presupuesto' && !conPresupuesto) {
      return {
        disponible: false,
        motivo: cotizacion.motivo ?? 'Este viaje necesita un presupuesto a medida.',
        metadata: { motivo: 'requiere_presupuesto' },
      };
    }

    return {
      disponible: true,
      capacidadRestante: empresa.unidadesDisponibles,
      precioCalculado: cotizacion.total,
      // Sin `duracionMin` a propósito: con él el core trataría el viaje como
      // una cita y lo encajaría en el horario de oficina del transportista.
      metadata: {
        perros: solicitud.mascotas.length,
        requiereAceptacion: cotizacion.requiereAceptacion,
        plazoAceptacionMin: cotizacion.plazoAceptacionMin,
        // Queda en `reserva.detalle`: el cliente ve su desglose y el mapa del
        // seguimiento sabe de dónde sale y adónde va el viaje.
        detalleReserva: {
          desglose: conPresupuesto ? [{ concepto: 'Presupuesto aceptado', importe: precioAcordado }] : cotizacion.desglose,
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

  private async disponibilidadAntigua(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const transporte = await this.servicioModel.findById(servicioId).lean().exec() as (Transporte & { _id: unknown }) | null;

    if (!transporte) {
      throw new DomainException('Servicio de transporte no encontrado', 404);
    }

    if ((transporte.unidadesDisponibles ?? 0) <= 0) {
      return { disponible: false, motivo: 'Este transportista no tiene vehículos libres ahora mismo.' };
    }

    // El número de perros viaja en `detalle.perros`; `cantidad` llega fija a 1
    // desde el asistente, así que comprobar sólo con ella no limitaba nada.
    const perros = Math.max(1, Number(params.parametrosExtra?.['perros']) || params.cantidad || 1);
    const maximo = Math.min(transporte.capacidadPerros, transporte.maxPerrosPorTrayecto || Infinity);
    if (perros > maximo) {
      return {
        disponible: false,
        motivo: `Este vehículo admite como máximo ${maximo} perro(s) por trayecto.`,
        metadata: { motivo: 'capacidad_insuficiente', capacidadPerros: maximo, perros },
      };
    }

    const distanciaKm = Math.max(this.distanciaSolicitada(params), transporte.distanciaMinimaKm ?? 0);
    if (distanciaKm <= 0) {
      throw new DomainException('La distancia del trayecto debe ser mayor que 0', 400);
    }

    const exclusivo = this.exclusivoSolicitado(params);
    const suplementoExclusivo = exclusivo ? (transporte.precioExclusivo ?? 0) : 0;
    const extras = this.calcularExtras(transporte, params);

    // Ida y vuelta con espera (Ref. TRA4): un solo servicio en vez de dos reservas
    // sueltas. Tarifa base y km se cobran por duplicado (ida + vuelta); la espera
    // se cobra aparte, a la tarifa/hora que el transportista haya configurado.
    const idaVuelta = params.parametrosExtra?.['tipoTrayecto'] === 'ida_vuelta';
    const esperaMinutos = idaVuelta ? this.esperaSolicitada(params) : 0;
    const multiplicadorTrayecto = idaVuelta ? 2 : 1;
    const cargoEspera = Math.round(
      (transporte.tarifaEsperaPorHora ?? 0) * (esperaMinutos / 60) * 100,
    ) / 100;

    const precioCalculado = Math.round(
      ((transporte.tarifaBase + transporte.tarifaKm * distanciaKm) * multiplicadorTrayecto
        + suplementoExclusivo + extras + cargoEspera) * 100,
    ) / 100;

    return {
      disponible: true,
      capacidadRestante: transporte.unidadesDisponibles,
      precioCalculado,
      metadata: {
        distanciaKm,
        tipoVehiculo: transporte.tipoVehiculo,
        capacidadPerros: transporte.capacidadPerros,
        perros,
        exclusivo,
        extras,
        ...(idaVuelta ? { tipoTrayecto: 'ida_vuelta', esperaMinutos, cargoEspera } : {}),
      },
    };
  }

  /**
   * Cuánto se devuelve al cancelar: todo hasta X horas antes de la recogida,
   * el porcentaje tardío después, y nada con el viaje ya empezado.
   */
  async politicaReembolso(reserva: ReservaParaPoliticas, ahora = new Date()): Promise<PoliticaReembolso> {
    if (reserva.estado === ReservaEstado.EN_CURSO || reserva.seguimiento?.length) {
      return { porcentaje: 0, motivo: 'El viaje ya ha empezado.' };
    }
    const empresa = await this.repo.porId(reserva.servicioId);
    const politica = cancelacionDe(empresa ?? ({} as TransporteCotizable));
    const horasAntes = (reserva.fechaInicio.getTime() - ahora.getTime()) / 3_600_000;

    if (horasAntes >= politica.gratisHastaHoras) {
      return { porcentaje: 100, motivo: `Cancelación gratuita hasta ${politica.gratisHastaHoras} h antes.` };
    }
    return {
      porcentaje: politica.reembolsoTardioPct,
      motivo: `Menos de ${politica.gratisHastaHoras} h antes: se devuelve el ${politica.reembolsoTardioPct} %.`,
    };
  }

  /** La entrega necesita foto si el cliente la pidió al reservar. */
  validarHito(reserva: ReservaParaPoliticas, hito: string, fotoUrl?: string): void {
    const conocido = normalizarHitoViaje(hito);
    if (!(Object.values(HitoViaje) as string[]).includes(conocido)) {
      throw new DomainException('Ese paso del viaje no existe.', 400);
    }
    const entrega = reserva.detalle?.['entrega'] as { confirmacionEntrega?: string } | undefined;
    if (conocido === HitoViaje.ENTREGADA && entrega?.confirmacionEntrega === ConfirmacionEntrega.NOTIFICACION_FOTO && !fotoUrl) {
      throw new DomainException('El cliente pidió una foto de la entrega: adjúntala para marcarla.', 400);
    }
  }

  /** Minutos de espera solicitados en un trayecto de ida y vuelta (Ref. TRA4). */
  private esperaSolicitada(params: AvailabilityQuery): number {
    const raw = params.parametrosExtra?.['esperaMinutos'];
    if (raw === undefined || raw === null) return 0;
    const minutos = Number(raw);
    return Number.isFinite(minutos) && minutos > 0 ? minutos : 0;
  }

  private exclusivoSolicitado(params: AvailabilityQuery): boolean {
    return params.parametrosExtra?.['exclusivo'] === true;
  }

  /**
   * Suma los `serviciosAdicionales` que el transportista ha configurado y el
   * cliente ha elegido (HU-5.5.2/15.1). Se identifican por nombre, igual que en
   * alojamiento: el schema no tiene id estable por servicio adicional.
   */
  private calcularExtras(transporte: Transporte, params: AvailabilityQuery): number {
    const seleccionados = params.parametrosExtra?.['extras'];
    if (!Array.isArray(seleccionados) || seleccionados.length === 0) return 0;
    const disponibles = transporte.serviciosAdicionales ?? [];
    return seleccionados.reduce((suma: number, nombre) => {
      const extra = disponibles.find((e) => e.nombre === nombre);
      return suma + (extra?.precio ?? 0);
    }, 0);
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

  private distanciaSolicitada(params: AvailabilityQuery): number {
    const raw = params.parametrosExtra?.['distanciaKm'];
    if (raw === undefined || raw === null) return DISTANCIA_DEFAULT_KM;
    const distancia = Number(raw);
    return Number.isFinite(distancia) ? distancia : DISTANCIA_DEFAULT_KM;
  }
}
