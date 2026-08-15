import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type LiquidacionDocument = HydratedDocument<Liquidacion>;

export type EstadoLiquidacion = 'pendiente' | 'pagada';

/**
 * Lo que se le paga a un comercio por un periodo (TCK-8040 §1). Hasta ahora el
 * importe se deducía de los pagos; sin este registro no había forma de saber
 * **qué se pagó, cuándo y con qué referencia**.
 */
@Schema({ timestamps: true, collection: 'liquidaciones' })
export class Liquidacion {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true, index: true })
  comercioId!: Types.ObjectId;

  /** Copia del nombre: el histórico debe leerse aunque el comercio cambie de nombre. */
  @Prop({ required: true })
  comercioNombre!: string;

  @Prop({ required: true })
  desde!: Date;

  @Prop({ required: true })
  hasta!: Date;

  @Prop({ required: true, type: Number })
  facturacionBruta!: number;

  @Prop({ required: true, type: Number })
  comisionPlataforma!: number;

  @Prop({ required: true, type: Number })
  stripeFee!: number;

  /** Lo que se transfiere al comercio: bruto menos comisión y pasarela. */
  @Prop({ required: true, type: Number })
  importeNeto!: number;

  @Prop({ type: Number, default: 0 })
  reservas!: number;

  @Prop({ type: String, enum: ['pendiente', 'pagada'], default: 'pendiente', index: true })
  estado!: EstadoLiquidacion;

  @Prop()
  fechaPago?: Date;

  /** Referencia de la transferencia, para poder casarla con el banco. */
  @Prop()
  referencia?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  generadaPorId?: Types.ObjectId;
}

export const LiquidacionSchema = SchemaFactory.createForClass(Liquidacion);

// El listado entra por comercio y ordena por periodo (ESR).
LiquidacionSchema.index({ comercioId: 1, hasta: -1 });
