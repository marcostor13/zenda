import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { PasoEmbudo, TipoEvento } from 'shared';

export type EventoDocument = HydratedDocument<Evento>;

/**
 * Traza del embudo. Es intencionadamente genérica: la alimentan el frontend
 * (marcas de tiempo del embudo) y el backend (confirmaciones, servicios
 * completados), y de ella salen tanto la métrica de "reservar en menos de 30 s"
 * como la detección de abandonos.
 *
 * **No guarda datos personales más allá de los identificadores**: quien quiera
 * el nombre o el email va a `usuarios`. Así el TTL puede purgarla sin tocar
 * nada que haya que conservar.
 */
@Schema({ timestamps: true, collection: 'eventos' })
export class Evento {
  @Prop({ type: String, enum: Object.values(TipoEvento), required: true })
  tipo!: TipoEvento;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  usuarioId?: Types.ObjectId;

  /** Identifica al visitante sin sesión, para no perder su embudo. */
  @Prop()
  sesionId?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Carrito' })
  carritoId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Servicio' })
  servicioId?: Types.ObjectId;

  @Prop()
  vertical?: string;

  /** Paso exacto del embudo; es lo que permite recuperar un abandono con contexto. */
  @Prop({ type: String, enum: Object.values(PasoEmbudo) })
  paso?: PasoEmbudo;

  /**
   * Milisegundos desde que empezó el embudo de esta sesión. Es la medida de
   * T4 ("reservar en menos de 30 s"): sin esto, la meta no es verificable.
   */
  @Prop({ type: Number })
  msDesdeInicio?: number;

  @Prop({ type: Object, default: {} })
  payload!: Record<string, unknown>;
}

export const EventoSchema = SchemaFactory.createForClass(Evento);

EventoSchema.index({ tipo: 1, createdAt: -1 });
EventoSchema.index({ sesionId: 1, createdAt: 1 });
EventoSchema.index({ usuarioId: 1, tipo: 1, createdAt: -1 });
// Telemetría, no contabilidad: caduca a los 180 días para no crecer sin fin.
EventoSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
