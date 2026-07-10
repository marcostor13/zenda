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
import { Peluqueria, ServicioGrooming } from './peluqueria.schema';

const MINUTOS_TTL = 15;

interface HoldEntry { holdId: string; servicioId: string; expiraEn: Date; }

/**
 * Vertical Peluquería canina: citas de grooming por cupos. Disponible si quedan
 * cupos para los perros solicitados. El precio depende del servicio de grooming
 * elegido (o del precio base) × número de perros.
 */
@Injectable()
export class PeluqueriaAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.PELUQUERIA;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const peluqueria = await this.servicioModel.findById(servicioId).lean().exec() as (Peluqueria & { _id: unknown }) | null;

    if (!peluqueria) {
      throw new DomainException('Peluquería canina no encontrada', 404);
    }

    const perros = Math.max(1, params.cantidad ?? 1);

    if ((peluqueria.cuposDisponibles ?? 0) < perros) {
      return { disponible: false, capacidadRestante: peluqueria.cuposDisponibles ?? 0 };
    }

    const servicio = this.servicioGroomingSolicitado(peluqueria, params);
    const precioUnitario = servicio?.precio ?? peluqueria.precioBase;

    return {
      disponible: true,
      capacidadRestante: peluqueria.cuposDisponibles,
      precioCalculado: Math.round(precioUnitario * perros * 100) / 100,
      metadata: {
        perros,
        ...(servicio ? { servicio: servicio.nombre } : {}),
        duracionMin: servicio?.duracionMin ?? peluqueria.duracionSlotMin,
      },
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

  private servicioGroomingSolicitado(peluqueria: Peluqueria, params: AvailabilityQuery): ServicioGrooming | undefined {
    const nombre = params.parametrosExtra?.['servicio'];
    if (typeof nombre !== 'string' || !nombre) return undefined;
    return (peluqueria.serviciosGrooming ?? []).find((s) => s.nombre === nombre);
  }
}
