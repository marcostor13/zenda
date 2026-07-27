import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vacuna, calcularTamanoPorPeso } from 'shared';
import { Perro, PerroDocument } from './perro.schema';
import { PerroHistorial, PerroHistorialDocument } from './perro-historial.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Cada eje aporta su peso al índice; suman 100. */
const PESOS = {
  vacunas: 35,
  revisiones: 25,
  peso: 20,
  prevencion: 20,
} as const;

/** Vacunas básicas que se esperan de un perro con la pauta al día. */
const VACUNAS_BASICAS = [Vacuna.ANTIRRABICA, Vacuna.TETRAVALENTE, Vacuna.TOS_PERRERA];

const MESES_REVISION_RECOMENDADA = 12;
const DIAS_POR_MES = 30;

export interface EjeBienestar {
  clave: keyof typeof PESOS;
  etiqueta: string;
  puntos: number;
  maximo: number;
  /** Qué haría subir este eje. Vacío si ya está al máximo. */
  consejo?: string;
}

export interface IndiceBienestar {
  perroId: string;
  /** 0–100. Cuanto más alto, mejor cuidado preventivo. */
  puntuacion: number;
  nivel: 'inicial' | 'bueno' | 'muy_bueno' | 'excelente';
  /** Descuento sobre la prima del seguro, estilo bonus-malus (HU-041). */
  descuentoSeguroPct: number;
  ejes: EjeBienestar[];
}

/**
 * Índice de Bienestar Doogking (HU-041).
 *
 * Premia el cuidado preventivo con un descuento en el seguro: vacunas al día,
 * revisiones periódicas, peso adecuado y prevención. No es un diagnóstico ni
 * pretende serlo — es un incentivo, y por eso cada eje explica qué haría subirlo
 * en vez de limitarse a dar una nota.
 */
@Injectable()
export class BienestarService {
  constructor(
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
    @InjectModel(PerroHistorial.name)
    private readonly historialModel: Model<PerroHistorialDocument>,
  ) {}

  async calcular(perroId: string): Promise<IndiceBienestar> {
    if (!Types.ObjectId.isValid(perroId)) {
      throw new DomainException('Identificador de perro no válido', 400);
    }

    const perro = await this.perroModel.findById(perroId).lean().exec();
    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }

    const revisiones = await this.historialModel
      .find({ perroId: new Types.ObjectId(perroId), vertical: 'veterinaria' })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean()
      .exec();

    const ejes: EjeBienestar[] = [
      this.ejeVacunas(perro),
      this.ejeRevisiones(revisiones as Array<{ createdAt?: Date }>),
      this.ejePeso(perro),
      this.ejePrevencion(perro),
    ];

    const puntuacion = Math.round(ejes.reduce((suma, e) => suma + e.puntos, 0));

    return {
      perroId,
      puntuacion,
      nivel: this.nivel(puntuacion),
      descuentoSeguroPct: this.descuento(puntuacion),
      ejes,
    };
  }

  private ejeVacunas(perro: Perro): EjeBienestar {
    const puestas = new Set((perro.vacunasDetalle ?? []).map((v) => v.tipo));
    const faltan = VACUNAS_BASICAS.filter((v) => !puestas.has(v));
    const cubiertas = VACUNAS_BASICAS.length - faltan.length;
    const puntos = (cubiertas / VACUNAS_BASICAS.length) * PESOS.vacunas;

    return {
      clave: 'vacunas',
      etiqueta: 'Vacunación al día',
      puntos,
      maximo: PESOS.vacunas,
      consejo: faltan.length
        ? 'Registra la antirrábica, la tetravalente y la tos de las perreras en su ficha.'
        : undefined,
    };
  }

  private ejeRevisiones(revisiones: Array<{ createdAt?: Date }>): EjeBienestar {
    const ultima = revisiones[0]?.createdAt;
    const mesesDesde = ultima
      ? (Date.now() - new Date(ultima).getTime()) / (DIAS_POR_MES * 24 * 60 * 60 * 1000)
      : Infinity;

    // Puntuación completa dentro del año; decae hasta cero a los dos años.
    const factor = mesesDesde <= MESES_REVISION_RECOMENDADA
      ? 1
      : Math.max(0, 1 - (mesesDesde - MESES_REVISION_RECOMENDADA) / MESES_REVISION_RECOMENDADA);

    return {
      clave: 'revisiones',
      etiqueta: 'Revisiones veterinarias',
      puntos: factor * PESOS.revisiones,
      maximo: PESOS.revisiones,
      consejo: factor < 1
        ? 'Una revisión anual mantiene este apartado al máximo y abarata el seguro.'
        : undefined,
    };
  }

  private ejePeso(perro: Perro): EjeBienestar {
    // Sin peso no se puede valorar, pero tampoco se penaliza a ciegas: se da la
    // mitad y se pide el dato.
    if (!perro.peso) {
      return {
        clave: 'peso',
        etiqueta: 'Peso adecuado',
        puntos: PESOS.peso / 2,
        maximo: PESOS.peso,
        consejo: 'Añade su peso a la ficha para afinar el índice y el precio del seguro.',
      };
    }

    const coherente = perro.tamano ? calcularTamanoPorPeso(perro.peso) === perro.tamano : true;

    return {
      clave: 'peso',
      etiqueta: 'Peso adecuado',
      puntos: coherente ? PESOS.peso : PESOS.peso * 0.6,
      maximo: PESOS.peso,
      consejo: coherente
        ? undefined
        : 'Su peso no encaja con el tamaño indicado; revisa ambos datos con tu veterinario.',
    };
  }

  private ejePrevencion(perro: Perro): EjeBienestar {
    // Señales de cuidado preventivo que ya están en la ficha.
    const señales = [
      Boolean(perro.microchip),
      perro.esterilizado,
      Boolean(perro.cartillaSanitariaUrl),
      (perro.enfermedades ?? []).length === 0,
    ];
    const cumplidas = señales.filter(Boolean).length;

    return {
      clave: 'prevencion',
      etiqueta: 'Prevención y documentación',
      puntos: (cumplidas / señales.length) * PESOS.prevencion,
      maximo: PESOS.prevencion,
      consejo: cumplidas < señales.length
        ? 'Registrar el microchip y subir la cartilla sanitaria suma en este apartado.'
        : undefined,
    };
  }

  private nivel(puntuacion: number): IndiceBienestar['nivel'] {
    if (puntuacion >= 90) return 'excelente';
    if (puntuacion >= 75) return 'muy_bueno';
    if (puntuacion >= 50) return 'bueno';
    return 'inicial';
  }

  /** Bonus-malus: tramos, no una función continua, para que sea explicable. */
  private descuento(puntuacion: number): number {
    if (puntuacion >= 90) return 0.15;
    if (puntuacion >= 75) return 0.1;
    if (puntuacion >= 50) return 0.05;
    return 0;
  }
}
