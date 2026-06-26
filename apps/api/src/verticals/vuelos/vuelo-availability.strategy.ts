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
import { Vuelo } from './vuelo.schema';

const MINUTOS_TTL = 15;

interface HoldEntry { holdId: string; servicioId: string; expiraEn: Date; }

/**
 * Vertical Vuelos: reserva de asientos en un trayecto/horario fijo. Disponible
 * si quedan asientos para la cantidad pedida; precio = precioAsiento × cantidad.
 */
@Injectable()
export class VueloAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.VUELOS;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const vuelo = await this.servicioModel.findById(servicioId).lean().exec() as (Vuelo & { _id: unknown }) | null;

    if (!vuelo) {
      throw new DomainException('Vuelo no encontrado', 404);
    }

    const asientos = Math.max(1, params.cantidad ?? 1);

    if ((vuelo.asientosDisponibles ?? 0) < asientos) {
      return { disponible: false, capacidadRestante: vuelo.asientosDisponibles ?? 0 };
    }

    return {
      disponible: true,
      capacidadRestante: vuelo.asientosDisponibles,
      precioCalculado: Math.round(vuelo.precioAsiento * asientos * 100) / 100,
      metadata: { asientos, origen: vuelo.origen, destino: vuelo.destino },
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
}
