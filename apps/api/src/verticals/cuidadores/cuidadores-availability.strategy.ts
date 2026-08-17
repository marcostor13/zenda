import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TamanoPerro, VerticalKey } from 'shared';
import {
  AvailabilityStrategy,
  AvailabilityQuery,
  AvailabilityResult,
  ReserveParams,
  SlotHold,
} from '../../core/availability/availability.strategy';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Cuidadores, ModalidadCuidado } from './cuidadores.schema';

const MINUTOS_TTL = 15;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

/**
 * Vertical Paseadores y cuidado a domicilio: visitas/paseos al domicilio del
 * cliente, con cupos diarios. Reutiliza el patrón de cupos ya probado en
 * adiestramiento; el precio depende de la modalidad pedida.
 */
@Injectable()
export class CuidadoresAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.CUIDADORES;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const cuidador = (await this.servicioModel.findById(servicioId).lean().exec()) as
      | (Cuidadores & { _id: unknown })
      | null;

    if (!cuidador) {
      throw new DomainException('Servicio no encontrado', 404);
    }

    const visitas = Math.max(1, params.cantidad ?? 1);
    if ((cuidador.cuposDisponibles ?? 0) < visitas) {
      return {
        disponible: false,
        capacidadRestante: cuidador.cuposDisponibles ?? 0,
        metadata: { motivo: 'sin_cupos' },
      };
    }

    const modalidad = this.modalidadPedida(params);
    if (!cuidador.modalidades?.includes(modalidad)) {
      return { disponible: false, metadata: { motivo: 'modalidad_no_ofrecida' } };
    }

    const tamano = params.parametrosExtra?.['perroTamano'] ?? params.parametrosExtra?.['tamano'];
    // Lista vacía = sin restricción de tamaño.
    if (typeof tamano === 'string' && cuidador.tamanosAdmitidos?.length
        && !cuidador.tamanosAdmitidos.includes(tamano as TamanoPerro)) {
      return { disponible: false, metadata: { motivo: 'tamano_no_admitido' } };
    }

    const esPPP = params.parametrosExtra?.['perroEsPPP'] ?? params.parametrosExtra?.['esPPP'];
    if (esPPP === true && !cuidador.aceptaPPP) {
      return { disponible: false, metadata: { motivo: 'no_acepta_ppp' } };
    }

    const precioUnitario = this.precioDe(cuidador, modalidad);
    if (precioUnitario == null) {
      return { disponible: false, metadata: { motivo: 'modalidad_sin_precio' } };
    }

    return {
      disponible: true,
      capacidadRestante: cuidador.cuposDisponibles - visitas,
      precioCalculado: Math.round(precioUnitario * visitas * 100) / 100,
      metadata: { modalidad },
    };
  }

  async reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold> {
    const disponibilidad = await this.checkAvailability(servicioId, {
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad,
      parametrosExtra: params.parametrosExtra,
    });

    if (!disponibilidad.disponible) {
      throw new DomainException('El profesional no tiene disponibilidad para esa fecha', 409);
    }

    const hold: HoldEntry = {
      holdId: `cui-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      servicioId,
      expiraEn: new Date(Date.now() + MINUTOS_TTL * 60 * 1000),
    };
    this.holds.set(hold.holdId, hold);

    return { ...hold, metadata: disponibilidad.metadata };
  }

  async releaseSlot(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }

  private modalidadPedida(params: AvailabilityQuery): ModalidadCuidado {
    const pedida = params.parametrosExtra?.['modalidad'] as ModalidadCuidado | undefined;
    return pedida ?? 'visita';
  }

  private precioDe(cuidador: Cuidadores, modalidad: ModalidadCuidado): number | null {
    if (modalidad === 'paseo') return cuidador.precioPaseo ?? null;
    if (modalidad === 'dia_completo') return cuidador.precioDiaCompleto ?? null;
    if (modalidad === 'noche') return cuidador.precioNoche ?? null;
    return cuidador.precioVisita ?? null;
  }
}
