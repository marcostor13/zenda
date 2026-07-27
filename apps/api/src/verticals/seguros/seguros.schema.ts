import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TipoSeguro } from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type SegurosDocument = HydratedDocument<Seguros>;

/** Límite de cobertura de una garantía concreta de la póliza. */
export interface LimiteCobertura {
  tipo: TipoSeguro;
  /** Capital máximo cubierto al año, en euros. */
  limiteAnualEur: number;
  /** Días desde la contratación durante los que la garantía aún no cubre. */
  carenciaDias?: number;
  /** Importe que asume el cliente en cada siniestro. */
  franquiciaEur?: number;
}

/** Condiciones que debe cumplir la mascota para poder contratar. */
export interface CondicionesAdmision {
  edadMinimaMeses?: number;
  edadMaximaAnios?: number;
  pesoMaximoKg?: number;
  razasExcluidas?: string[];
  /** true = no admite perros de razas PPP en esta póliza. */
  excluyePPP?: boolean;
  /** true = exige vacunación al día para dar cobertura. */
  requiereVacunasAlDia?: boolean;
  /** Recargo sobre la prima cuando la mascota es admisible pero de mayor riesgo. */
  recargoRiesgoPct?: number;
}

/**
 * Discriminador del vertical Seguros.
 *
 * Es un vertical de pleno derecho, no un añadido transversal (HU-039): tiene su
 * propia semántica de "disponibilidad" —que aquí significa **elegibilidad de la
 * mascota**, no calendario— y su propio ciclo de vida en la colección `polizas`.
 */
@Schema({ _id: false })
export class Seguros extends Servicio {
  @Prop({ type: [String], enum: Object.values(TipoSeguro), default: [] })
  tiposSeguro!: TipoSeguro[];

  @Prop({ type: [Object], default: [] })
  limitesCobertura!: LimiteCobertura[];

  @Prop({ type: Object, default: {} })
  condicionesAdmision!: CondicionesAdmision;

  /** Prima anual de referencia; el importe final lo valida la aseguradora. */
  @Prop({ type: Number, required: true })
  primaAnualBase!: number;

  /** Descuento por pagar el año completo por adelantado. */
  @Prop({ type: Number, default: 0 })
  descuentoPagoAnualPct!: number;

  /** Duración de la póliza en meses; 12 = anual, valores menores = temporal. */
  @Prop({ type: Number, default: 12 })
  duracionMeses!: number;

  @Prop({ type: Boolean, default: true })
  renovacionAutomatica!: boolean;

  /** Pólizas que la aseguradora puede emitir a la vez; 0 = sin límite. */
  @Prop({ type: Number, default: 0 })
  cupoPolizas!: number;

  @Prop()
  documentoCondicionesUrl?: string;
}

export const SegurosSchema = SchemaFactory.createForClass(Seguros);
