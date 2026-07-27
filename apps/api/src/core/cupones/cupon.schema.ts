import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { AsumeDescuento } from 'shared';

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

  // --- Campañas y atribución del descuento (HU-057) ---
  /**
   * Quién paga el descuento. Es el dato que separa un descuento comercial
   * (coste de la plataforma) de una promoción del negocio (coste suyo): sin él,
   * el margen del reporte financiero sería falso.
   */
  @Prop({
    type: String,
    enum: Object.values(AsumeDescuento),
    default: AsumeDescuento.PLATAFORMA,
  })
  asumeDescuento!: AsumeDescuento;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Campana' })
  campanaId?: Types.ObjectId;

  /** Solo para la primera reserva del usuario (captación). */
  @Prop({ type: Boolean, default: false })
  soloPrimeraReserva!: boolean;

  /** Restringe el cupón a comercios de una cohorte concreta (socios fundadores…). */
  @Prop()
  cohorte?: string;
}

export const CuponSchema = SchemaFactory.createForClass(Cupon);
CuponSchema.index({ codigo: 1 }, { unique: true });
