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
    const precioCalculado = Math.round(
      (transporte.tarifaBase + transporte.tarifaKm * distanciaKm + suplementoExclusivo) * 100,
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
      },
    };
  }

  private exclusivoSolicitado(params: AvailabilityQuery): boolean {
    return params.parametrosExtra?.['exclusivo'] === true;
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
