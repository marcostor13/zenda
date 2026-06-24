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
import { Hotel } from './hotel.schema';

const MINUTOS_TTL = 15;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

@Injectable()
export class HotelAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.HOTELES;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const hotel = await this.servicioModel.findById(servicioId).lean().exec() as (Hotel & { _id: unknown }) | null;

    if (!hotel) {
      throw new DomainException('Hotel no encontrado', 404);
    }

    if (!params.fechaFin) {
      throw new DomainException('Se requiere fechaFin para reservar hoteles', 400);
    }

    const noches = this.calcularNoches(params.fechaInicio, params.fechaFin);

    if (noches <= 0) {
      return { disponible: false };
    }

    const habitacion = hotel.habitaciones?.[0];

    if (!habitacion || habitacion.cantidad <= 0) {
      return { disponible: false };
    }

    return {
      disponible: true,
      capacidadRestante: habitacion.cantidad,
      precioCalculado: habitacion.precio * noches,
      metadata: { noches },
    };
  }

  async reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold> {
    const holdId = `hold-${servicioId}-${Date.now()}`;
    const expiraEn = new Date(Date.now() + MINUTOS_TTL * 60 * 1000);

    this.holds.set(holdId, { holdId, servicioId, expiraEn });

    return { holdId, servicioId, expiraEn };
  }

  async releaseSlot(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }

  private calcularNoches(inicio: Date, fin: Date): number {
    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    return Math.round((fin.getTime() - inicio.getTime()) / MS_POR_DIA);
  }
}
