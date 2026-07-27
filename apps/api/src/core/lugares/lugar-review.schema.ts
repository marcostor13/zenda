import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { EstadoModeracion } from 'shared';

export type LugarReviewDocument = HydratedDocument<LugarReview>;

/**
 * Aportación de un usuario sobre un lugar: valoración, consejo, incidencia o
 * fotos (HU-043). Igual que los lugares, **entra en moderación**: el contenido
 * de usuario no se publica solo.
 */
@Schema({ timestamps: true, collection: 'lugar_reviews' })
export class LugarReview {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Lugar', required: true })
  lugarId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  /** Nombre mostrado, congelado al publicar para no depender del perfil. */
  @Prop({ required: true })
  usuarioNombre!: string;

  @Prop({ type: Number, min: 1, max: 5, required: true })
  puntuacion!: number;

  @Prop({ default: '', trim: true })
  texto!: string;

  @Prop({ type: [String], default: [] })
  fotos!: string[];

  /** true = el usuario reporta un problema (obras, cierre, normativa nueva). */
  @Prop({ type: Boolean, default: false })
  esIncidencia!: boolean;

  @Prop({ type: String, enum: Object.values(EstadoModeracion), default: EstadoModeracion.PENDIENTE })
  estado!: EstadoModeracion;
}

export const LugarReviewSchema = SchemaFactory.createForClass(LugarReview);

LugarReviewSchema.index({ lugarId: 1, estado: 1, createdAt: -1 });
// Una valoración por usuario y lugar; las incidencias no cuentan como valoración.
LugarReviewSchema.index(
  { lugarId: 1, usuarioId: 1 },
  { unique: true, partialFilterExpression: { esIncidencia: false } },
);
LugarReviewSchema.index({ estado: 1, createdAt: -1 });
