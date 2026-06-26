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
const PESO_DEFAULT_KG = 100;

interface HoldEntry { holdId: string; servicioId: string; expiraEn: Date; }

/**
 * Vertical Transporte de carga: disponible si el peso solicitado cabe en la
 * capacidad; precio = tarifaBase + tarifaKg × peso. El peso llega en
 * parametrosExtra.pesoKg.
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

    const pesoKg = this.pesoSolicitado(params);

    if ((transporte.capacidadKg ?? 0) < pesoKg) {
      return { disponible: false, capacidadRestante: transporte.capacidadKg ?? 0 };
    }

    return {
      disponible: true,
      capacidadRestante: transporte.capacidadKg,
      precioCalculado: Math.round((transporte.tarifaBase + transporte.tarifaKg * pesoKg) * 100) / 100,
      metadata: { pesoKg, tipoCarga: transporte.tipoCarga },
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

  private pesoSolicitado(params: AvailabilityQuery): number {
    const peso = Number(params.parametrosExtra?.['pesoKg']);
    return Number.isFinite(peso) && peso > 0 ? peso : PESO_DEFAULT_KG;
  }
}
