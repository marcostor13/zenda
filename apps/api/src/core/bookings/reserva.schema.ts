import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VerticalKey, ReservaEstado, MONEDA_DEFAULT } from 'shared';

export type ReservaDocument = HydratedDocument<Reserva>;

@Schema({ timestamps: true, collection: 'reservas' })
export class Reserva {
  @Prop({ required: true, unique: true })
  codigo!: string;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Servicio', required: true })
  servicioId!: Types.ObjectId;

  @Prop({ type: String, enum: VerticalKey, required: true })
  vertical!: VerticalKey;

  @Prop({ type: Object, required: true })
  detalle!: Record<string, unknown>;

  @Prop({ required: true })
  fechaInicio!: Date;

  @Prop()
  fechaFin?: Date;

  @Prop({ default: 1, type: Number })
  cantidad!: number;

  @Prop({ required: true, type: Number })
  montoSubtotal!: number;

  @Prop({ required: true, type: Number })
  comisionMonto!: number;

  @Prop({ required: true, type: Number })
  montoTotal!: number;

  @Prop({ type: Number, default: 0 })
  descuentoMonto!: number;

  @Prop()
  cuponCodigo?: string;

  @Prop({ default: MONEDA_DEFAULT })
  moneda!: string;

  @Prop({ type: String, enum: ReservaEstado, default: ReservaEstado.PENDIENTE })
  estado!: ReservaEstado;

  @Prop({ type: Types.ObjectId, ref: 'Pago' })
  pagoId?: Types.ObjectId;

  @Prop()
  holdId?: string;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);

ReservaSchema.index({ usuarioId: 1, estado: 1, createdAt: -1 });
ReservaSchema.index({ comercioId: 1, estado: 1, fechaInicio: 1 });
