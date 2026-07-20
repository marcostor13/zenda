import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey } from 'shared';

export type PerroValoracionDocument = HydratedDocument<PerroValoracion>;

/**
 * Reputación bidireccional (docs/mejora_servicios.md §7): el comercio valora
 * al perro tras completar una reserva, alimentando su "pasaporte digital".
 * Una valoración por reserva, igual que las reseñas cliente→comercio.
 */
@Schema({ timestamps: true, collection: 'perro_valoraciones' })
export class PerroValoracion {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Perro', required: true })
  perroId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva', required: true, unique: true })
  reservaId!: Types.ObjectId;

  @Prop({ type: String, enum: VerticalKey, required: true })
  vertical!: VerticalKey;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  puntuacion!: number;

  // Dimensiones específicas por vertical, ej. { sociabilidad: 5, limpieza: 4 }.
  @Prop({ type: Object, default: {} })
  atributos!: Record<string, number>;

  @Prop({ trim: true })
  comentario?: string;
}

export const PerroValoracionSchema = SchemaFactory.createForClass(PerroValoracion);
PerroValoracionSchema.index({ reservaId: 1 }, { unique: true });
PerroValoracionSchema.index({ perroId: 1, createdAt: -1 });
