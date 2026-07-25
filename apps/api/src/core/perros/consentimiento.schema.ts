import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { TipoHistorial, VerticalKey } from 'shared';

export type ConsentimientoDocument = HydratedDocument<Consentimiento>;

/**
 * Autorización explícita del propietario para que un tipo de servicio vea un
 * tipo de historial de su mascota (HU-016).
 *
 * **Regla por defecto: lo que genera un vertical solo lo ve ese vertical.** No
 * existir un documento aquí significa "no compartido"; nunca lo contrario. Cada
 * concesión y cada revocación quedan fechadas, que es lo que exige el RGPD.
 */
@Schema({ timestamps: true, collection: 'consentimientos' })
export class Consentimiento {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Perro', required: true })
  perroId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  propietarioId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TipoHistorial), required: true })
  tipoHistorial!: TipoHistorial;

  /** Vertical que podrá leer ese historial. */
  @Prop({ type: String, enum: Object.values(VerticalKey), required: true })
  verticalDestino!: VerticalKey;

  @Prop({ type: Boolean, default: false })
  concedido!: boolean;

  @Prop()
  fechaConcesion?: Date;

  @Prop()
  fechaRevocacion?: Date;
}

export const ConsentimientoSchema = SchemaFactory.createForClass(Consentimiento);

ConsentimientoSchema.index(
  { perroId: 1, tipoHistorial: 1, verticalDestino: 1 },
  { unique: true },
);
