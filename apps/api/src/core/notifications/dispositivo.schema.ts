import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type DispositivoDocument = HydratedDocument<Dispositivo>;

export type PlataformaDispositivo = 'android' | 'ios' | 'web';

/**
 * Dispositivo registrado para notificaciones push (M2 de `CLAUDE.md`).
 *
 * El registro del token es independiente del proveedor de envío: la app puede
 * registrarse hoy y el envío real conectarse cuando existan las credenciales de
 * FCM/APNs, sin volver a tocar el cliente.
 */
@Schema({ timestamps: true, collection: 'dispositivos' })
export class Dispositivo {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  /** Token del proveedor (FCM o APNs). Único por dispositivo. */
  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({ type: String, enum: ['android', 'ios', 'web'], required: true })
  plataforma!: PlataformaDispositivo;

  /** Se desactiva al recibir un rechazo del proveedor, no se borra. */
  @Prop({ type: Boolean, default: true })
  activo!: boolean;

  @Prop()
  ultimoEnvio?: Date;
}

export const DispositivoSchema = SchemaFactory.createForClass(Dispositivo);

DispositivoSchema.index({ usuarioId: 1, activo: 1 });
DispositivoSchema.index({ token: 1 }, { unique: true });
