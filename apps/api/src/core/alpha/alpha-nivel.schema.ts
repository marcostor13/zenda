import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey } from 'shared';

export type AlphaNivelConfigDocument = HydratedDocument<AlphaNivelConfig>;

/**
 * Un escalón del programa de fidelización Doogking Alpha (Bloque 13):
 * niveles por nº de reservas completadas, no por puntos. Configurable desde
 * el panel de administración (HU-13.4) — nº de niveles, umbral, descuento y
 * beneficios de cada uno viven aquí, nada fijo en el código.
 */
@Schema({ timestamps: true, collection: 'alpha_niveles' })
export class AlphaNivelConfig {
  @Prop({ required: true, unique: true, type: Number })
  nivel!: number;

  @Prop({ required: true })
  nombre!: string; // ej. "Alpha 2"

  @Prop({ required: true, type: Number, default: 0 })
  reservasRequeridas!: number;

  @Prop({ required: true, type: Number, default: 0 })
  descuentoPct!: number; // ej. 0.05 = 5%

  @Prop({ type: [String], default: [] })
  beneficios!: string[];

  /** Tope del descuento en euros. Ausente = sin límite (TCK-8030 §10). */
  @Prop({ type: Number })
  descuentoMaximoEur?: number;

  /** Categorías donde aplica. Lista vacía = todas, que es el caso habitual. */
  @Prop({ type: [String], default: [] })
  verticalesAplicables!: VerticalKey[];

  @Prop({ type: Date })
  vigenciaDesde?: Date;

  @Prop({ type: Date })
  vigenciaHasta?: Date;

  @Prop({ default: true })
  activo!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  actualizadoPor?: Types.ObjectId;
}

export const AlphaNivelConfigSchema = SchemaFactory.createForClass(AlphaNivelConfig);
AlphaNivelConfigSchema.index({ nivel: 1 }, { unique: true });
