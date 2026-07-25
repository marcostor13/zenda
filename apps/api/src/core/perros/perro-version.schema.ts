import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type PerroVersionDocument = HydratedDocument<PerroVersion>;

/**
 * Foto de la ficha **antes** de cada cambio (HU-001: "cada cambio queda
 * versionado con fecha").
 *
 * Importa porque el precio de una reserva se calcula con los datos declarados:
 * si alguien discute un suplemento, hay que poder demostrar qué decía la ficha
 * en ese momento y cuándo cambió.
 */
@Schema({ timestamps: true, collection: 'perro_versiones' })
export class PerroVersion {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Perro', required: true })
  perroId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  cambiadoPor!: Types.ObjectId;

  /** Campos modificados en este cambio, para leer el historial de un vistazo. */
  @Prop({ type: [String], default: [] })
  campos!: string[];

  /** Valor anterior de la ficha, tal y como estaba antes del cambio. */
  @Prop({ type: Object, required: true })
  anterior!: Record<string, unknown>;
}

export const PerroVersionSchema = SchemaFactory.createForClass(PerroVersion);
PerroVersionSchema.index({ perroId: 1, createdAt: -1 });
