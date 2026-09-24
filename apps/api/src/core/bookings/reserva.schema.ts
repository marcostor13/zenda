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

export interface CambioEstadoReserva {
  estado: string;
  motivo?: string;
  por: string; // rol o id que ejecutó el cambio (ej. 'admin')
  at: Date;
}

/** Hito de seguimiento en tiempo real del servicio (transporte/residencia…). */
export interface SeguimientoHito {
  hito: string; // 'recogida' | 'en_ruta' | 'entregada' | 'entrada' | 'salida' | 'finalizada' …
  nota?: string;
  /** Foto del momento (p. ej. la entrega en transporte, si el cliente la pidió). */
  fotoUrl?: string;
  at: Date;
}

/** Otra mascota del cliente en la misma reserva, con su ficha congelada. */
export interface MascotaAdicional {
  perroId: Types.ObjectId;
  snapshot: Record<string, unknown>;
}

export type EstadoAceptacion = 'pendiente' | 'aceptada' | 'rechazada' | 'caducada';

/**
 * Visto bueno del comercio en reservas sin hora cerrada o urgentes (E4). El
 * cliente paga igual al reservar; si el comercio no acepta en plazo, se le
 * devuelve el dinero. Lo decide la estrategia del vertical, no el core.
 */
export interface AceptacionReserva {
  requerida: boolean;
  estado: EstadoAceptacion;
  plazoMin: number;
  /** Se fija al confirmarse el pago: el plazo corre desde que hay dinero. */
  venceEn?: Date;
  resueltaAt?: Date;
  motivo?: string;
}

/** Devolución hecha al cancelar según la política del vertical. */
export interface ReembolsoReserva {
  porcentaje: number;
  importe: number;
  motivo: string;
  at: Date;
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

  @Prop({ type: [Object], default: undefined })
  perrosAdicionales?: MascotaAdicional[];

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

  /**
   * De dónde salió el porcentaje aplicado (socio fundador, override, tramo…).
   * Se guarda para que el reporte financiero pueda explicar cada comisión sin
   * recalcularla, y para auditar si un comercio reclama su tarifa.
   */
  @Prop()
  comisionOrigen?: string;

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

  // --- Viaje multi-vertical (Ola 5) ---
  /**
   * Reserva principal del viaje (normalmente el alojamiento). Es **solo una
   * relación de presentación**: cancelar la madre no cancela a las hijas, cada
   * reserva tiene su propia política y su propio ciclo de vida (HU-035).
   */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaMadreId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Carrito' })
  carritoId?: Types.ObjectId;

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

  // Timeline de estados: cada transición operativa (confirmada, en curso,
  // pago retenido/liberado, disputa, reembolso…) queda registrada aquí.
  @Prop({ type: [Object], default: [] })
  historialEstados!: CambioEstadoReserva[];

  // Hitos de seguimiento en tiempo real que el comercio va marcando.
  @Prop({ type: [Object], default: [] })
  seguimiento!: SeguimientoHito[];

  /** Serie de reservas recurrentes (docs §4.3): presente solo en las reservas hija. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaOrigenId?: Types.ObjectId;

  @Prop({ type: Object })
  aceptacion?: AceptacionReserva;

  @Prop({ type: Object })
  reembolso?: ReembolsoReserva;
}

export const ReservaSchema = SchemaFactory.createForClass(Reserva);

ReservaSchema.index({ usuarioId: 1, estado: 1, createdAt: -1 });
ReservaSchema.index({ comercioId: 1, estado: 1, fechaInicio: 1 });
// Vista "Mi viaje": todas las reservas de un mismo viaje, en orden cronológico.
ReservaSchema.index({ reservaMadreId: 1, fechaInicio: 1 }, { sparse: true });
ReservaSchema.index({ carritoId: 1 }, { sparse: true });
// Expediente de la mascota: qué comercios la han atendido y con qué reservas.
ReservaSchema.index({ perroId: 1, comercioId: 1, fechaInicio: -1 }, { sparse: true });
// Caducador de aceptaciones: reservas pagadas que el comercio aún no ha aceptado.
ReservaSchema.index({ 'aceptacion.estado': 1, 'aceptacion.venceEn': 1 }, { sparse: true });
