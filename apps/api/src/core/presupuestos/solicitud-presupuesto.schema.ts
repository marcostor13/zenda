import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { EstadoRespuestaPresupuesto, EstadoSolicitudPresupuesto, VerticalKey } from 'shared';

export type SolicitudPresupuestoDocument = HydratedDocument<SolicitudPresupuesto>;

/** Lo que contesta cada empresa a la que se pidió presupuesto. */
export interface RespuestaPresupuesto {
  servicioId: Types.ObjectId;
  comercioId: Types.ObjectId;
  estado: EstadoRespuestaPresupuesto;
  /** Precio final, IVA incluido: lo que se cobrará al aceptar. */
  importe?: number;
  condiciones?: string;
  validoHasta?: Date;
  motivoRechazo?: string;
  respondidaAt?: Date;
}

/**
 * Solicitud de presupuesto a medida (diapositiva 11 del flujo de transporte).
 *
 * Una solicitud va a una o varias empresas; cada una responde por su cuenta y
 * el cliente acepta **una**. Al pagar, la solicitud se convierte en reserva con
 * el importe que dio esa empresa (`bookings.crear` con `presupuestoId`).
 */
@Schema({ timestamps: true, collection: 'solicitudes_presupuesto' })
export class SolicitudPresupuesto {
  @Prop({ required: true, unique: true })
  codigo!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: String, enum: VerticalKey, required: true })
  vertical!: VerticalKey;

  /** Lo que describió el cliente en el vertical; el cliente no lo vuelve a rellenar. */
  @Prop({ type: Object, required: true })
  detalle!: Record<string, unknown>;

  @Prop({ required: true })
  fechaServicio!: Date;

  @Prop()
  comentario?: string;

  @Prop({ type: String, enum: EstadoSolicitudPresupuesto, default: EstadoSolicitudPresupuesto.ABIERTA })
  estado!: EstadoSolicitudPresupuesto;

  @Prop({ type: [Object], default: [] })
  respuestas!: RespuestaPresupuesto[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  createdAt?: Date;
}

export const SolicitudPresupuestoSchema = SchemaFactory.createForClass(SolicitudPresupuesto);

SolicitudPresupuestoSchema.index({ usuarioId: 1, createdAt: -1 });
SolicitudPresupuestoSchema.index({ 'respuestas.comercioId': 1, createdAt: -1 });
SolicitudPresupuestoSchema.index({ estado: 1, fechaServicio: 1 });
