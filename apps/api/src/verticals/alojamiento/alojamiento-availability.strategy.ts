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
import { Alojamiento } from './alojamiento.schema';

const MINUTOS_TTL = 15;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

@Injectable()
export class AlojamientoAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.ALOJAMIENTO;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const alojamiento = await this.servicioModel.findById(servicioId).lean().exec() as (Alojamiento & { _id: unknown }) | null;

    if (!alojamiento) {
      throw new DomainException('Alojamiento no encontrado', 404);
    }

    if (!params.fechaFin) {
      throw new DomainException('Se requiere fechaFin para reservar alojamiento canino', 400);
    }

    const noches = this.calcularNoches(params.fechaInicio, params.fechaFin);

    if (noches <= 0) {
      return { disponible: false };
    }

    const espacio = alojamiento.espacios?.[0];

    if (!espacio || espacio.cantidad <= 0) {
      return { disponible: false };
    }

    const perros = Math.max(1, params.cantidad ?? 1);

    return {
      disponible: true,
      capacidadRestante: espacio.cantidad,
      precioCalculado: espacio.precioNoche * noches * perros,
      metadata: { noches, perros },
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
