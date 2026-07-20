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
import { Alojamiento, EspacioCanino } from './alojamiento.schema';

const MINUTOS_TTL = 15;

/** Orden de tamaño (de menor a mayor) para validar que el perro cabe en el `tamanoMaxPerro` del espacio. */
const ORDEN_TAMANO = ['mini', 'pequeno', 'mediano', 'grande', 'gigante'];

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

    const espacio = this.espacioSolicitado(alojamiento, params);

    if (!espacio || espacio.cantidad <= 0) {
      return { disponible: false };
    }

    this.validarTamano(espacio, params);
    this.validarCompatibilidadSocial(alojamiento, params);

    const perros = Math.max(1, params.cantidad ?? 1);

    return {
      disponible: true,
      capacidadRestante: espacio.cantidad,
      precioCalculado: espacio.precioNoche * noches * perros,
      metadata: { noches, perros },
    };
  }

  /** Usa el espacio elegido por el cliente (`espacioId`); si no se indica, el primero con cupo. */
  private espacioSolicitado(alojamiento: Alojamiento, params: AvailabilityQuery): EspacioCanino | undefined {
    const espacioId = params.parametrosExtra?.['espacioId'];
    if (typeof espacioId === 'string' && espacioId) {
      return (alojamiento.espacios ?? []).find((e) => e.id === espacioId);
    }
    return (alojamiento.espacios ?? []).find((e) => e.cantidad > 0);
  }

  /**
   * Bloquea la reserva si el perro supera el `tamanoMaxPerro` declarado por el espacio.
   * Un espacio sin `tamanoMaxPerro` admite cualquier tamaño (docs/mejora_servicios.md §2.1).
   */
  private validarTamano(espacio: EspacioCanino, params: AvailabilityQuery): void {
    if (!espacio.tamanoMaxPerro) return;
    const perroTamano = params.parametrosExtra?.['perroTamano'] ?? params.parametrosExtra?.['tamanoPerro'];
    if (typeof perroTamano !== 'string') return;

    const indicePerro = ORDEN_TAMANO.indexOf(perroTamano);
    const indiceMax = ORDEN_TAMANO.indexOf(espacio.tamanoMaxPerro);
    if (indicePerro === -1 || indiceMax === -1) return;

    if (indicePerro > indiceMax) {
      throw new DomainException(
        `Este espacio admite perros hasta tamaño "${espacio.tamanoMaxPerro}"`,
        409,
      );
    }
  }

  /**
   * Bloquea la reserva si el perfil de compatibilidad social declarado no está entre los
   * admitidos por la residencia. Un array vacío/ausente admite cualquier perfil.
   */
  private validarCompatibilidadSocial(alojamiento: Alojamiento, params: AvailabilityQuery): void {
    if (!alojamiento.compatibilidadSocialAdmitida?.length) return;
    const compatibilidad = params.parametrosExtra?.['compatibilidadSocial'];
    if (typeof compatibilidad !== 'string' || !compatibilidad) return;

    if (!alojamiento.compatibilidadSocialAdmitida.includes(compatibilidad)) {
      throw new DomainException(
        'Esta residencia no admite el perfil de compatibilidad social indicado para tu perro',
        409,
      );
    }
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
