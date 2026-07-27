import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { EstadoSolicitudValoracion } from 'shared';

export type SolicitudValoracionDocument = HydratedDocument<SolicitudValoracion>;

/**
 * Petición de reseña enviada al cliente tras completarse un servicio (HU-053).
 *
 * Existe como documento propio, y no como un flag en la reserva, porque hay que
 * poder responder a "¿se envió?, ¿la abrió?, ¿se le recordó?" — que es
 * justamente el panel de seguimiento que pide HU-054.
 */
@Schema({ timestamps: true, collection: 'solicitudes_valoracion' })
export class SolicitudValoracion {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva', required: true })
  reservaId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  /** Token de un solo uso del enlace del correo; identifica la reserva concreta. */
  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({
    type: String,
    enum: Object.values(EstadoSolicitudValoracion),
    default: EstadoSolicitudValoracion.PENDIENTE,
  })
  estado!: EstadoSolicitudValoracion;

  @Prop()
  enviadaAt?: Date;

  @Prop()
  abiertaAt?: Date;

  @Prop()
  completadaAt?: Date;

  /** Solo se permite un recordatorio: insistir más quema la lista de correo. */
  @Prop({ type: Boolean, default: false })
  recordatorioEnviado!: boolean;

  @Prop()
  recordatorioAt?: Date;

  @Prop()
  error?: string;
}

export const SolicitudValoracionSchema = SchemaFactory.createForClass(SolicitudValoracion);

// Una solicitud por reserva: el índice impide duplicar el envío.
SolicitudValoracionSchema.index({ reservaId: 1 }, { unique: true });
SolicitudValoracionSchema.index({ estado: 1, enviadaAt: 1 });
