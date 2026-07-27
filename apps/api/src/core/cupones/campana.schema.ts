import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type CampanaDocument = HydratedDocument<Campana>;

export type CanalCampana = 'email' | 'push' | 'in_app';

/**
 * Campaña de marketing: agrupa cupones y envíos para poder medir qué costó y
 * qué trajo (HU-057). Sin agrupar, un cupón suelto no dice si la promoción fue
 * rentable — solo cuántas veces se usó.
 */
@Schema({ timestamps: true, collection: 'campanas' })
export class Campana {
  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ default: '' })
  descripcion!: string;

  @Prop({ type: [String], default: ['email'] })
  canales!: CanalCampana[];

  @Prop({ type: Date, required: true })
  desde!: Date;

  @Prop({ type: Date, required: true })
  hasta!: Date;

  @Prop({ type: Boolean, default: true })
  activa!: boolean;

  /** Envíos realizados; alimenta la tasa de conversión del panel. */
  @Prop({ type: Number, default: 0 })
  enviados!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  creadaPor?: Types.ObjectId;
}

export const CampanaSchema = SchemaFactory.createForClass(Campana);

CampanaSchema.index({ activa: 1, desde: 1, hasta: 1 });
