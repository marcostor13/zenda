import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ModoDisponibilidadTransporte, VerticalKey, admiteEspecie, calcularPrecioTransporte,
} from 'shared';
import {
  AvailabilityStrategy,
  AvailabilityQuery,
  AvailabilityResult,
  ReserveParams,
  SlotHold,
} from '../../core/availability/availability.strategy';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Transporte } from './transporte.schema';
import { configDeServicio, solicitudDesdeParametros } from './transporte-config';

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
 * Lo que sí decide esta clase es si el viaje **se puede hacer**: si hay
 * vehículo, si caben las mascotas, si la especie entra, si llega con la
 * antelación que pide la empresa. Cuando el motor no puede cerrar un precio, la
 * respuesta no es «no disponible» sino «esto va por presupuesto», que es un
 * camino distinto y sigue siendo una venta.
 */
@Injectable()
export class TransporteAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.TRANSPORTE;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
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

    const metadata = {
      distanciaKm: desglose.distanciaKm,
      kmFacturables: desglose.kmFacturables,
      tipoVehiculo: transporte.tipoVehiculo,
      capacidadPerros: transporte.capacidadPerros,
      perros: solicitud.mascotas,
      desglose: desglose.lineas,
      reglaAplicada: desglose.reglaAplicada,
      requiereConfirmacion: this.requiereConfirmacion(config, params),
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
