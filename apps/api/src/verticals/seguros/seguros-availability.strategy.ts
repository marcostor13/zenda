import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ResultadoElegibilidad, VerticalKey } from 'shared';
import {
  AvailabilityStrategy,
  AvailabilityQuery,
  AvailabilityResult,
  ReserveParams,
  SlotHold,
} from '../../core/availability/availability.strategy';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { CondicionesAdmision, Seguros } from './seguros.schema';

const MINUTOS_TTL = 15;
const MESES_POR_ANIO = 12;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

/** Perfil de la mascota que llega en `parametrosExtra` al evaluar elegibilidad. */
interface PerfilMascota {
  edadMeses?: number;
  pesoKg?: number;
  raza?: string;
  esPPP?: boolean;
  vacunasAlDia?: boolean;
}

export interface ResultadoAdmision {
  resultado: ResultadoElegibilidad;
  /** Por qué no es elegible, o por qué lleva recargo. En texto para el cliente. */
  motivo?: string;
  recargoPct: number;
}

/**
 * Vertical Seguros.
 *
 * `checkAvailability` **no consulta un calendario**: comprueba si la mascota
 * cumple las condiciones de admisión de la póliza (HU-039). Es la misma
 * interfaz del core con otra semántica, que es justo lo que permite el patrón
 * de estrategias: añadir Seguros no ha obligado a tocar el núcleo.
 */
@Injectable()
export class SegurosAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.SEGUROS;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const poliza = (await this.servicioModel.findById(servicioId).lean().exec()) as
      | (Seguros & { _id: unknown })
      | null;

    if (!poliza) {
      throw new DomainException('Póliza no encontrada', 404);
    }

    const perfil = (params.parametrosExtra ?? {}) as PerfilMascota;
    const admision = this.evaluarAdmision(poliza.condicionesAdmision ?? {}, perfil);

    if (admision.resultado === ResultadoElegibilidad.NO_ELEGIBLE) {
      return {
        disponible: false,
        motivo: admision.motivo,
        metadata: { elegibilidad: admision.resultado, motivo: admision.motivo },
      };
    }

    // Cupo de emisión de la aseguradora; 0 significa sin límite.
    if (poliza.cupoPolizas > 0 && this.holds.size >= poliza.cupoPolizas) {
      return {
        disponible: false,
        motivo: 'La aseguradora ha agotado su cupo de pólizas.',
        metadata: {
          elegibilidad: admision.resultado,
          motivo: 'La aseguradora ha agotado su cupo de pólizas.',
        },
      };
    }

    return {
      disponible: true,
      capacidadRestante: poliza.cupoPolizas > 0 ? poliza.cupoPolizas - this.holds.size : undefined,
      precioCalculado: this.calcularPrima(poliza, admision.recargoPct),
      metadata: {
        elegibilidad: admision.resultado,
        motivo: admision.motivo,
        recargoPct: admision.recargoPct,
        // El precio es orientativo hasta que la aseguradora valida (HU-040).
        precioOrientativo: true,
      },
    };
  }

  async reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold> {
    const disponibilidad = await this.checkAvailability(servicioId, {
      fechaInicio: params.fechaInicio,
      parametrosExtra: params.parametrosExtra,
    });

    if (!disponibilidad.disponible) {
      const motivo = (disponibilidad.metadata?.['motivo'] as string) ?? 'No cumple las condiciones de admisión.';
      throw new DomainException(motivo, 409);
    }

    const hold: HoldEntry = {
      holdId: `seg-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      servicioId,
      expiraEn: new Date(Date.now() + MINUTOS_TTL * 60 * 1000),
    };
    this.holds.set(hold.holdId, hold);

    return { ...hold, metadata: disponibilidad.metadata };
  }

  async releaseSlot(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }

  /**
   * Comprueba las condiciones de admisión una por una y devuelve el **primer**
   * motivo de rechazo, no una lista: al cliente le sirve más saber qué corregir
   * que recibir un muro de incumplimientos.
   */
  evaluarAdmision(condiciones: CondicionesAdmision, perfil: PerfilMascota): ResultadoAdmision {
    const sinRecargo = { recargoPct: 0 };

    if (condiciones.edadMinimaMeses != null && (perfil.edadMeses ?? 0) < condiciones.edadMinimaMeses) {
      return {
        ...sinRecargo,
        resultado: ResultadoElegibilidad.NO_ELEGIBLE,
        motivo: `Esta póliza admite mascotas a partir de ${condiciones.edadMinimaMeses} meses.`,
      };
    }

    if (condiciones.edadMaximaAnios != null && perfil.edadMeses != null) {
      const edadAnios = perfil.edadMeses / MESES_POR_ANIO;
      if (edadAnios > condiciones.edadMaximaAnios) {
        return {
          ...sinRecargo,
          resultado: ResultadoElegibilidad.NO_ELEGIBLE,
          motivo: `Esta póliza no admite mascotas de más de ${condiciones.edadMaximaAnios} años.`,
        };
      }
    }

    if (condiciones.pesoMaximoKg != null && (perfil.pesoKg ?? 0) > condiciones.pesoMaximoKg) {
      return {
        ...sinRecargo,
        resultado: ResultadoElegibilidad.NO_ELEGIBLE,
        motivo: `Esta póliza cubre mascotas de hasta ${condiciones.pesoMaximoKg} kg.`,
      };
    }

    if (condiciones.excluyePPP && perfil.esPPP) {
      return {
        ...sinRecargo,
        resultado: ResultadoElegibilidad.NO_ELEGIBLE,
        motivo: 'Esta póliza no cubre razas potencialmente peligrosas. Busca una con cobertura PPP.',
      };
    }

    if (this.razaExcluida(condiciones.razasExcluidas, perfil.raza)) {
      return {
        ...sinRecargo,
        resultado: ResultadoElegibilidad.NO_ELEGIBLE,
        motivo: `La aseguradora no cubre la raza ${perfil.raza}.`,
      };
    }

    if (condiciones.requiereVacunasAlDia && perfil.vacunasAlDia === false) {
      return {
        ...sinRecargo,
        resultado: ResultadoElegibilidad.NO_ELEGIBLE,
        motivo: 'Esta póliza exige tener la vacunación al día. Actualiza la ficha de tu mascota.',
      };
    }

    // Admisible, pero de mayor riesgo: se cubre con recargo en vez de rechazar.
    if (condiciones.recargoRiesgoPct && perfil.esPPP) {
      return {
        resultado: ResultadoElegibilidad.ELEGIBLE_CON_RECARGO,
        recargoPct: condiciones.recargoRiesgoPct,
        motivo: 'Se aplica un recargo por tratarse de una raza potencialmente peligrosa.',
      };
    }

    return { ...sinRecargo, resultado: ResultadoElegibilidad.ELEGIBLE };
  }

  /** Prima del periodo contratado, con el recargo de riesgo si corresponde. */
  private calcularPrima(poliza: Seguros, recargoPct: number): number {
    const meses = poliza.duracionMeses || MESES_POR_ANIO;
    const proporcional = (poliza.primaAnualBase * meses) / MESES_POR_ANIO;
    const conRecargo = proporcional * (1 + recargoPct);
    // El descuento por pago anual solo aplica a pólizas de año completo.
    const descuento = meses >= MESES_POR_ANIO ? poliza.descuentoPagoAnualPct : 0;

    return Math.round(conRecargo * (1 - descuento) * 100) / 100;
  }

  private razaExcluida(excluidas: string[] | undefined, raza?: string): boolean {
    if (!excluidas?.length || !raza) return false;
    const normalizar = (t: string): string =>
      t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

    return excluidas.some((e) => normalizar(e) === normalizar(raza));
  }
}
