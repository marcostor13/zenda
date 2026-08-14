import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { EstadoIncidencia, TipoIncidencia } from 'shared';

export type IncidenciaDocument = HydratedDocument<Incidencia>;

/** Una actuación sobre la incidencia: quién la tocó, cuándo y qué anotó. */
export interface ActuacionIncidencia {
  estado: EstadoIncidencia;
  nota?: string;
  por: string;
  at: Date;
}

/**
 * Reclamación, solicitud de devolución o incidencia abierta por un cliente o un
 * comercio (TCK-8040 §2). Vive aparte de la reserva porque una misma reserva
 * puede acumular varias, y porque hay que poder auditar cada actuación.
 */
@Schema({ timestamps: true, collection: 'incidencias' })
export class Incidencia {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  /** Copia del código de la reserva: el listado no debería resolverlo cada vez. */
  @Prop()
  codigoReserva?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  abiertaPorId!: Types.ObjectId;

  @Prop({ required: true })
  abiertaPorNombre!: string;

  /** Desde qué lado se abre: cambia a quién hay que dar explicaciones. */
  @Prop({ type: String, enum: ['cliente', 'comercio'], required: true })
  origen!: 'cliente' | 'comercio';

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio' })
  comercioId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TipoIncidencia), required: true })
  tipo!: TipoIncidencia;

  @Prop({ required: true, trim: true })
  asunto!: string;

  @Prop({ required: true })
  descripcion!: string;

  @Prop({ type: String, enum: Object.values(EstadoIncidencia), default: EstadoIncidencia.ABIERTA, index: true })
  estado!: EstadoIncidencia;

  /** Cómo se cerró; se rellena al pasar a resuelta. */
  @Prop()
  resolucion?: string;

  @Prop({ type: [Object], default: [] })
  historial!: ActuacionIncidencia[];
}

export const IncidenciaSchema = SchemaFactory.createForClass(Incidencia);

// El panel administrativo entra siempre por estado y ordena por fecha (ESR).
IncidenciaSchema.index({ estado: 1, createdAt: -1 });
