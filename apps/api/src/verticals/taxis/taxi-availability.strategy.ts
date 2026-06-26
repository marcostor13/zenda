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
import { Taxi } from './taxi.schema';

const MINUTOS_TTL = 15;
const DISTANCIA_DEFAULT_KM = 10;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

/**
 * Estrategia de disponibilidad/precio del vertical Taxis. A diferencia de los
 * hoteles (precio por noche, requiere fechaFin), aquí el servicio es por
 * trayecto on-demand: disponible si hay flota libre y el precio se calcula como
 * tarifaBase + tarifaKm × distancia. Mismo contrato AvailabilityStrategy, lógica
 * totalmente distinta — esto valida el patrón de extensibilidad sin tocar el core.
 */
@Injectable()
export class TaxiAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.TAXIS;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const taxi = await this.servicioModel.findById(servicioId).lean().exec() as (Taxi & { _id: unknown }) | null;

    if (!taxi) {
      throw new DomainException('Servicio de taxi no encontrado', 404);
    }

    if ((taxi.unidadesDisponibles ?? 0) <= 0) {
      return { disponible: false };
    }

    const distanciaKm = this.distanciaSolicitada(params);
    if (distanciaKm <= 0) {
      throw new DomainException('La distancia del trayecto debe ser mayor que 0', 400);
    }

    const precioCalculado = Math.round((taxi.tarifaBase + taxi.tarifaKm * distanciaKm) * 100) / 100;

    return {
      disponible: true,
      capacidadRestante: taxi.unidadesDisponibles,
      precioCalculado,
      metadata: { distanciaKm, tipoVehiculo: taxi.tipoVehiculo, capacidad: taxi.capacidad },
    };
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
    const distancia = Number(raw);
    return Number.isFinite(distancia) && distancia > 0 ? distancia : DISTANCIA_DEFAULT_KM;
  }
}
