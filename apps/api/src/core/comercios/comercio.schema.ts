import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { VerticalKey } from 'shared';

export type ComercioDocument = HydratedDocument<Comercio>;

export type PlanComercio = 'basico' | 'pro' | 'premium';
export type EstadoComercio = 'pendiente' | 'activo' | 'suspendido';
export type ModoLiquidacion = 'merchant' | 'agencia';

@Schema({ timestamps: true, collection: 'comercios' })
export class Comercio {
  @Prop({ required: true })
  razonSocial!: string;

  @Prop({ required: true, unique: true })
  vatNumber!: string;

  @Prop({ required: true })
  nombreComercial!: string;

  @Prop()
  logoUrl?: string;

  @Prop({ type: [String], enum: VerticalKey, default: [] })
  verticales!: VerticalKey[];

  @Prop({ type: String, default: 'merchant' })
  modoLiquidacion!: ModoLiquidacion;

  @Prop({ type: Number })
  comisionPctOverride?: number;

  @Prop({ type: String, enum: ['basico', 'pro', 'premium'], default: 'basico' })
  plan!: PlanComercio;

  @Prop({ type: String, enum: ['pendiente', 'activo', 'suspendido'], default: 'pendiente' })
  estado!: EstadoComercio;

  @Prop({ type: Object })
  datosBancarios?: Record<string, string>;
}

export const ComercioSchema = SchemaFactory.createForClass(Comercio);

ComercioSchema.index({ vatNumber: 1 }, { unique: true });
