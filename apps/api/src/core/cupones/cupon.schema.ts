import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CuponDocument = HydratedDocument<Cupon>;

export type TipoCupon = 'porcentaje' | 'fijo';

@Schema({ timestamps: true, collection: 'cupones' })
export class Cupon {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  codigo!: string;

  @Prop({ type: String, enum: ['porcentaje', 'fijo'], required: true })
  tipo!: TipoCupon;

  /** Porcentaje (0–1) si tipo='porcentaje', o importe en € si tipo='fijo'. */
  @Prop({ type: Number, required: true })
  valor!: number;

  /** Vertical al que aplica, o 'global' para todos. */
  @Prop({ type: String, default: 'global' })
  vertical!: string;

  @Prop({ type: Number, default: 0 })
  montoMinimo!: number;

  /** Tope de descuento en € (solo para porcentaje); 0 = sin tope. */
  @Prop({ type: Number, default: 0 })
  topeDescuento!: number;

  @Prop({ type: Number, default: 0 })
  usoMaximo!: number; // 0 = ilimitado

  @Prop({ type: Number, default: 0 })
  usados!: number;

  @Prop({ type: Date })
  validoHasta?: Date;

  @Prop({ default: true })
  activo!: boolean;

  @Prop()
  descripcion?: string;
}

export const CuponSchema = SchemaFactory.createForClass(Cupon);
CuponSchema.index({ codigo: 1 }, { unique: true });
