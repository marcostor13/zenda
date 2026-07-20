import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey, ReservaEstado, MONEDA_DEFAULT } from 'shared';

export type ReservaDocument = HydratedDocument<Reserva>;

export interface SuplementoAplicado {
  concepto: string;
  monto: number;
  aplicadoPor: string; // comercioId
  motivo?: string;
  evidenciaUrl?: string;
  createdAt: Date;
}

export interface EvidenciaReserva {
  tipo: string; // 'estado_llegada' | 'cartilla' | 'video' | ...
  url: string;
  createdAt: Date;
}

@Schema({ timestamps: true, collection: 'reservas' })
export class Reserva {
  @Prop({ required: true, unique: true })
  codigo!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Servicio', required: true })
  servicioId!: Types.ObjectId;

  @Prop({ type: String, enum: VerticalKey, required: true })
  vertical!: VerticalKey;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Perro' })
  perroId?: Types.ObjectId;

  // Copia congelada de los datos del perro en el momento de reservar (con qué
  // información se calculó el precio), para poder auditar disputas de ajuste.
  @Prop({ type: Object })
  perroSnapshot?: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  detalle!: Record<string, unknown>;

  @Prop({ required: true })
  fechaInicio!: Date;

  @Prop()
  fechaFin?: Date;

  @Prop({ default: 1, type: Number })
  cantidad!: number;

  @Prop({ required: true, type: Number })
  montoSubtotal!: number;

  @Prop({ required: true, type: Number })
  comisionMonto!: number;

  @Prop({ required: true, type: Number })
  montoTotal!: number;

  @Prop({ type: Number, default: 0 })
  descuentoMonto!: number;

  @Prop()
  cuponCodigo?: string;

  @Prop({ default: MONEDA_DEFAULT })
  moneda!: string;

  @Prop({ type: String, enum: ReservaEstado, default: ReservaEstado.PENDIENTE })
  estado!: ReservaEstado;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Pago' })
  pagoId?: Types.ObjectId;

  @Prop()
  holdId?: string;

  // --- Ciclo de precio estimado -> suplemento -> aprobación (docs/mejora_servicios.md §7) ---
  @Prop({ type: [Object], default: [] })
  suplementos!: SuplementoAplicado[];

  // Nuevo total propuesto mientras el ajuste está pendiente de aprobación del cliente.
  @Prop({ type: Number })
  montoAjustado?: number;

  @Prop()
  ajusteSolicitadoAt?: Date;

  @Prop()
  ajusteResueltoAt?: Date;

  @Prop({ type: [Object], default: [] })
  evidencias!: EvidenciaReserva[];

  /** Serie de reservas recurrentes (docs §4.3): presente solo en las reservas hija. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaOrigenId?: Types.ObjectId;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);

ReservaSchema.index({ usuarioId: 1, estado: 1, createdAt: -1 });
ReservaSchema.index({ comercioId: 1, estado: 1, fechaInicio: 1 });
