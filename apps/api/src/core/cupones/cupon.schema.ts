import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { AsumeDescuento } from 'shared';

export type CuponDocument = HydratedDocument<Cupon>;

export type TipoCupon = 'porcentaje' | 'fijo';

@Schema({ timestamps: true, collection: 'cupones' })
export class Cupon {
  // La unicidad la declara el índice del final del fichero: con las dos,
  // Mongoose avisa de un índice duplicado en cada arranque.
  @Prop({ required: true, uppercase: true, trim: true })
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

  /**
   * Cuántas veces puede usarlo **cada** usuario; 0 = sin límite por persona.
   * Sin esto, una sola persona podía agotar el cupón (TCK-8037 §6).
   */
  @Prop({ type: Number, default: 0 })
  usosPorUsuario!: number;

  /** Restringe el cupón a un comercio concreto; vacío = cualquiera (TCK-8037 §5). */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio' })
  comercioId?: Types.ObjectId;

  /** Restringe el cupón a una ciudad; vacío = toda España (TCK-8037 §5). */
  @Prop({ trim: true })
  ciudad?: string;

  /** Nivel Alpha mínimo del cliente para poder usarlo; 0 = cualquiera. */
  @Prop({ type: Number, default: 0 })
  nivelAlphaMinimo!: number;

  /** Restringe el cupón a comercios de una cohorte concreta (socios fundadores…). */
  @Prop()
  cohorte?: string;
}

export const CuponSchema = SchemaFactory.createForClass(Cupon);
CuponSchema.index({ codigo: 1 }, { unique: true });
