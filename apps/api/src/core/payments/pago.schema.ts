import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PagoEstado, PagoPasarela, MONEDA_DEFAULT } from 'shared';

export type PagoDocument = HydratedDocument<Pago>;

@Schema({ timestamps: true, collection: 'pagos' })
export class Pago {
  @Prop({ type: Types.ObjectId, ref: 'Reserva', required: true })
  reservaId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: String, enum: PagoPasarela, default: PagoPasarela.STRIPE })
  pasarela!: PagoPasarela;

  @Prop({ required: true, type: Number })
  montoTotal!: number;

  @Prop({ default: MONEDA_DEFAULT })
  moneda!: string;

  // Desglose financiero visible en el admin
  @Prop({ required: true, type: Number })
  montoSubtotal!: number;

  @Prop({ required: true, type: Number })
  ivaMonto!: number;

  @Prop({ required: true, type: Number })
  comisionPlataforma!: number;

  @Prop({ required: true, type: Number })
  stripeFee!: number;

  @Prop({ required: true, type: Number })
  montoLiquidacion!: number; // lo que recibe el comercio

  @Prop({ type: String, enum: PagoEstado, default: PagoEstado.INICIADO })
  estado!: PagoEstado;

  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  stripeChargeId?: string;

  @Prop({ type: Object })
  stripeMetadata?: Record<string, unknown>;
}

export const PagoSchema = SchemaFactory.createForClass(Pago);
PagoSchema.index({ reservaId: 1 });
PagoSchema.index({ stripePaymentIntentId: 1 }, { sparse: true, unique: true });
