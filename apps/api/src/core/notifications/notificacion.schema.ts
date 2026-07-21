import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type NotificacionDocument = HydratedDocument<Notificacion>;

export type CanalNotificacion = 'email';
export type EstadoNotificacion = 'pendiente' | 'enviado' | 'fallido';
export type TipoNotificacion = 'reserva_confirmada' | 'nueva_reserva_comercio' | 'verificacion_email';

/** Outbox de notificaciones: cada intento de envío queda registrado. */
@Schema({ timestamps: true, collection: 'notificaciones' })
export class Notificacion {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  @Prop({ type: String, enum: ['email'], default: 'email' })
  canal!: CanalNotificacion;

  @Prop({ type: String, required: true })
  tipo!: TipoNotificacion;

  @Prop({ required: true })
  destinatario!: string;

  @Prop({ required: true })
  asunto!: string;

  @Prop({ required: true })
  cuerpo!: string;

  @Prop({ type: String, enum: ['pendiente', 'enviado', 'fallido'], default: 'pendiente' })
  estado!: EstadoNotificacion;

  @Prop()
  error?: string;
}

export const NotificacionSchema = SchemaFactory.createForClass(Notificacion);
NotificacionSchema.index({ reservaId: 1 });
NotificacionSchema.index({ estado: 1, createdAt: -1 });
