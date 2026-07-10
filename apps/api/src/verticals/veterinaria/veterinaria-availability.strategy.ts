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
import { Veterinaria, ServicioClinico } from './veterinaria.schema';

const MINUTOS_TTL = 15;

interface HoldEntry { holdId: string; servicioId: string; expiraEn: Date; }

/**
 * Vertical Veterinaria: citas clínicas por cupos diarios. Disponible si quedan
 * citas para los perros solicitados. El precio depende del servicio clínico
 * elegido (o de la consulta general) × número de perros.
 */
@Injectable()
export class VeterinariaAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.VETERINARIA;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const clinica = await this.servicioModel.findById(servicioId).lean().exec() as (Veterinaria & { _id: unknown }) | null;

    if (!clinica) {
      throw new DomainException('Clínica veterinaria no encontrada', 404);
    }

    const perros = Math.max(1, params.cantidad ?? 1);

    if ((clinica.citasDisponibles ?? 0) < perros) {
      return { disponible: false, capacidadRestante: clinica.citasDisponibles ?? 0 };
    }

    const servicio = this.servicioClinicoSolicitado(clinica, params);
    const precioUnitario = servicio?.precio ?? clinica.precioConsulta;

    return {
      disponible: true,
      capacidadRestante: clinica.citasDisponibles,
      precioCalculado: Math.round(precioUnitario * perros * 100) / 100,
      metadata: {
        perros,
        ...(servicio ? { servicio: servicio.nombre } : {}),
        duracionMin: servicio?.duracionMin ?? clinica.duracionCitaMin,
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

  private servicioClinicoSolicitado(clinica: Veterinaria, params: AvailabilityQuery): ServicioClinico | undefined {
    const nombre = params.parametrosExtra?.['servicio'];
    if (typeof nombre !== 'string' || !nombre) return undefined;
    return (clinica.serviciosClinicos ?? []).find((s) => s.nombre === nombre);
  }
}
