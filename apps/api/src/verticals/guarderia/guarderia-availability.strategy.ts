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
import { Guarderia } from './guarderia.schema';

const MINUTOS_TTL = 15;

interface HoldEntry { holdId: string; servicioId: string; expiraEn: Date; }

/**
 * Vertical Guardería: cupo de cuidado infantil con cupos por edad. Disponible si
 * quedan cupos para los niños solicitados y su edad cae en el rango. El precio
 * depende de la modalidad del servicio (hora/día/mes) × número de niños.
 */
@Injectable()
export class GuarderiaAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.GUARDERIA;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const guarderia = await this.servicioModel.findById(servicioId).lean().exec() as (Guarderia & { _id: unknown }) | null;

    if (!guarderia) {
      throw new DomainException('Guardería no encontrada', 404);
    }

    const ninos = Math.max(1, params.cantidad ?? 1);

    if ((guarderia.cuposDisponibles ?? 0) < ninos) {
      return { disponible: false, capacidadRestante: guarderia.cuposDisponibles ?? 0 };
    }

    const edad = params.parametrosExtra?.['edadNino'];
    if (edad !== undefined && !this.edadEnRango(Number(edad), guarderia)) {
      return { disponible: false, metadata: { motivo: 'edad_fuera_de_rango' } };
    }

    const precioUnitario = this.precioPorModalidad(guarderia);

    return {
      disponible: true,
      capacidadRestante: guarderia.cuposDisponibles,
      precioCalculado: Math.round(precioUnitario * ninos * 100) / 100,
      metadata: { ninos, modalidad: guarderia.modalidad },
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

  private edadEnRango(edad: number, g: Guarderia): boolean {
    if (!Number.isFinite(edad)) return true;
    return edad >= (g.rangoEdadMin ?? 0) && edad <= (g.rangoEdadMax ?? 99);
  }

  private precioPorModalidad(g: Guarderia): number {
    switch (g.modalidad) {
      case 'hora': return g.precioHora || g.precioBase;
      case 'mes':  return g.precioMes || g.precioBase;
      case 'dia':
      default:     return g.precioDia || g.precioBase;
    }
  }
}
