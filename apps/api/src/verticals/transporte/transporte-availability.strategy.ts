import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VerticalKey } from 'shared';
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

const MINUTOS_TTL = 15;
const DISTANCIA_DEFAULT_KM = 10;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

/**
 * Estrategia de disponibilidad/precio del vertical Transporte de animales.
 * Servicio por trayecto A→B: disponible si hay unidades libres y los perros
 * solicitados caben en el vehículo. El precio es por trayecto (no por perro):
 * tarifaBase + tarifaKm × distancia.
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
      return { disponible: false };
    }

    const perros = Math.max(1, params.cantidad ?? 1);
    if (perros > transporte.capacidadPerros) {
      return {
        disponible: false,
        metadata: { motivo: 'capacidad_insuficiente', capacidadPerros: transporte.capacidadPerros, perros },
      };
    }

    const distanciaKm = this.distanciaSolicitada(params);
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
