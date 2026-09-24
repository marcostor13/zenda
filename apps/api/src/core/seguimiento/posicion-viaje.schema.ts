import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PosicionViajeDocument = HydratedDocument<PosicionViaje>;

/** Horas que se guarda una posición: dan para ver el viaje y reclamar, no más (RGPD). */
export const HORAS_RETENCION_POSICIONES = 48;

/**
 * Una posición del vehículo mientras el conductor comparte ubicación. Se
 * borran solas a las 48 h (índice TTL): una ruta concreta de una persona es un
 * dato personal y no hace falta más para el seguimiento ni para una disputa.
 */
@Schema({ collection: 'posiciones_viaje' })
export class PosicionViaje {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva', required: true })
  reservaId!: Types.ObjectId;

  @Prop({ required: true, type: Number })
  lat!: number;

  @Prop({ required: true, type: Number })
  lng!: number;

  @Prop({ type: Number })
  precision?: number;

  @Prop({ type: Number })
  rumbo?: number;

  @Prop({ required: true, default: () => new Date() })
  at!: Date;
}

export const PosicionViajeSchema = SchemaFactory.createForClass(PosicionViaje);

PosicionViajeSchema.index({ reservaId: 1, at: -1 });
PosicionViajeSchema.index({ at: 1 }, { expireAfterSeconds: HORAS_RETENCION_POSICIONES * 3600 });
