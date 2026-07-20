import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey } from 'shared';

export type ComisionConfigDocument = HydratedDocument<ComisionConfig>;

@Schema({ timestamps: true, collection: 'comision_configs' })
export class ComisionConfig {
  @Prop({ required: true })
  vertical!: string; // VerticalKey | 'global'

  @Prop({ required: true, type: Number })
  comisionPct!: number; // ej. 0.15 = 15%

  @Prop({ required: true, type: Number, default: 0.015 })
  stripePct!: number; // 1.5% (tarjetas EEE)

  @Prop({ required: true, type: Number, default: 0.25 })
  stripeFijoEur!: number; // €0.25 por transacción

  @Prop({ default: true })
  activo!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  actualizadoPor?: Types.ObjectId;
}

export const ComisionConfigSchema = SchemaFactory.createForClass(ComisionConfig);
ComisionConfigSchema.index({ vertical: 1 }, { unique: true });
