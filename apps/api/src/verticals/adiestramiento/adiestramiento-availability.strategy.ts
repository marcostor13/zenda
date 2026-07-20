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
import { Adiestramiento, ServicioAdiestramiento } from './adiestramiento.schema';

const MINUTOS_TTL = 15;

interface HoldEntry { holdId: string; servicioId: string; expiraEn: Date; }

/**
 * Vertical Adiestramiento canino: sesiones o programas con cupos por sesión.
 * Disponible si quedan cupos, no se supera la capacidad por sesión y el perro
 * cumple la edad mínima. El precio depende de la modalidad solicitada
 * (sesión/programa) × número de perros.
 */
@Injectable()
export class AdiestramientoAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.ADIESTRAMIENTO;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const adiestramiento = await this.servicioModel.findById(servicioId).lean().exec() as (Adiestramiento & { _id: unknown }) | null;

    if (!adiestramiento) {
      throw new DomainException('Servicio de adiestramiento no encontrado', 404);
    }

    const perros = Math.max(1, params.cantidad ?? 1);
    const servicio = this.servicioSolicitado(adiestramiento, params);
    const maxPerros = servicio?.maxPerros ?? adiestramiento.capacidadPorSesion ?? 0;

    if ((adiestramiento.cuposDisponibles ?? 0) < perros || perros > maxPerros) {
      return {
        disponible: false,
        capacidadRestante: adiestramiento.cuposDisponibles ?? 0,
        metadata: { motivo: 'capacidad_insuficiente' },
      };
    }

    const edad = params.parametrosExtra?.['edadMeses'];
    const edadMinima = servicio?.edadMinimaMeses ?? adiestramiento.edadMinimaMeses ?? 0;
    if (edad !== undefined && Number(edad) < edadMinima) {
      return { disponible: false, metadata: { motivo: 'edad_insuficiente' } };
    }
    if (edad !== undefined && servicio?.edadMaximaMeses !== undefined && Number(edad) > servicio.edadMaximaMeses) {
      return { disponible: false, metadata: { motivo: 'edad_excesiva' } };
    }

    const modalidad = this.modalidadSolicitada(adiestramiento, params);
    const precioUnitario = servicio?.precio
      ?? (modalidad === 'programa' && adiestramiento.precioPrograma ? adiestramiento.precioPrograma : adiestramiento.precioSesion);

    return {
      disponible: true,
      capacidadRestante: adiestramiento.cuposDisponibles,
      precioCalculado: Math.round(precioUnitario * perros * 100) / 100,
      metadata: { perros, modalidad, ...(servicio ? { servicio: servicio.nombre } : {}) },
    };
  }

  private servicioSolicitado(adiestramiento: Adiestramiento, params: AvailabilityQuery): ServicioAdiestramiento | undefined {
    const nombre = params.parametrosExtra?.['servicio'];
    if (typeof nombre !== 'string' || !nombre) return undefined;
    return (adiestramiento.serviciosAdiestramiento ?? []).find((s) => s.nombre === nombre);
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

  private modalidadSolicitada(adiestramiento: Adiestramiento, params: AvailabilityQuery): string {
    const modalidad = params.parametrosExtra?.['modalidad'];
    if (modalidad === 'programa' && adiestramiento.precioPrograma) return 'programa';
    return 'sesion';
  }
}
