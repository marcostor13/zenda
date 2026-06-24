import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VerticalKey } from 'shared';

export type ComisionConfigDocument = HydratedDocument<ComisionConfig>;

@Schema({ timestamps: true, collection: 'comision_configs' })
export class ComisionConfig {
  @Prop({ required: true })
  vertical!: string; // VerticalKey | 'global'

  @Prop({ required: true, type: Number })
  comisionPct!: number; // ej. 0.15 = 15%

  @Prop({ required: true, type: Number, default: 0.029 })
  stripePct!: number; // 2.9%

  @Prop({ required: true, type: Number, default: 1.1 })
  stripeFijoSoles!: number; // ~$0.30 USD en soles

  @Prop({ default: true })
  activo!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  actualizadoPor?: Types.ObjectId;
}

export const ComisionConfigSchema = SchemaFactory.createForClass(ComisionConfig);
ComisionConfigSchema.index({ vertical: 1 }, { unique: true });
