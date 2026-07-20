import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey } from 'shared';

export type PerroHistorialDocument = HydratedDocument<PerroHistorial>;

/**
 * Nota que un profesional deja en la ficha del perro tras un servicio
 * (comportamiento real, tiempo empleado, necesidades detectadas). Se acumula
 * para precalcular precio y dar contexto en próximas reservas.
 */
@Schema({ timestamps: true, collection: 'perro_historial' })
export class PerroHistorial {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Perro', required: true })
  perroId!: Types.ObjectId;

  @Prop({ type: String, enum: VerticalKey, required: true })
  vertical!: VerticalKey;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nota!: string;

  @Prop({ type: Object, default: {} })
  datosEstructurados!: Record<string, unknown>;
}

export const PerroHistorialSchema = SchemaFactory.createForClass(PerroHistorial);
PerroHistorialSchema.index({ perroId: 1, createdAt: -1 });
