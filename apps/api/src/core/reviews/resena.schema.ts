import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ResenaDocument = HydratedDocument<Resena>;

/**
 * Reseña transversal a todos los verticales. Se crea a partir de una reserva
 * confirmada/completada del usuario. Los campos de servicio/comercio/usuario se
 * desnormalizan para poder listarlas sin joins.
 */
@Schema({ timestamps: true, collection: 'resenas' })
export class Resena {
  // Una reseña por reserva.
  @Prop({ type: Types.ObjectId, ref: 'Reserva', required: true, unique: true })
  reservaId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  servicioId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  comercioId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ required: true })
  usuarioNombre!: string;

  @Prop({ required: true })
  servicioTitulo!: string;

  @Prop({ type: String, required: true })
  vertical!: string;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  puntuacion!: number;

  @Prop({ required: true, trim: true })
  comentario!: string;

  // Respuesta del comercio (opcional).
  @Prop({ type: String, default: null })
  respuesta?: string | null;
}

export const ResenaSchema = SchemaFactory.createForClass(Resena);
ResenaSchema.index({ reservaId: 1 }, { unique: true });
ResenaSchema.index({ servicioId: 1, createdAt: -1 });
ResenaSchema.index({ usuarioId: 1, createdAt: -1 });
ResenaSchema.index({ comercioId: 1, createdAt: -1 });
