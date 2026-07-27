import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey } from 'shared';

export type ComisionConfigDocument = HydratedDocument<ComisionConfig>;

/** Un escalón de la comisión por tramos: se aplica hasta `hastaEur` inclusive. */
export interface TramoComision {
  hastaEur: number;
  comisionPct: number;
}

@Schema({ timestamps: true, collection: 'comision_configs' })
export class ComisionConfig {
  @Prop({ required: true })
  vertical!: string; // VerticalKey | 'global'

  @Prop({ required: true, type: Number })
  comisionPct!: number; // ej. 0.15 = 15%

  /**
   * Comisión por tramo de importe (HU-046). Si está vacío se usa `comisionPct`
   * plano, así que activar los tramos no rompe las liquidaciones existentes.
   * `hastaEur` es el límite superior del tramo; el último debe ser `Infinity`
   * (o un valor muy alto) para cubrir el resto.
   */
  @Prop({ type: [{ hastaEur: Number, comisionPct: Number }], default: [] })
  tramos!: TramoComision[];

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
