import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { EstadoPresupuesto, MONEDA_DEFAULT, VerticalKey } from 'shared';

export type PresupuestoDocument = HydratedDocument<Presupuesto>;

/**
 * Una solicitud de precio a medida.
 *
 * Existe porque hay trayectos que ninguna tarifa publicada puede cerrar
 * —internacionales, varias mascotas, rutas con paradas, animales especiales— y
 * la alternativa era enseñar «no disponible» a un cliente que estaba
 * dispuesto a pagar. Guarda la solicitud entera, así que cuando la empresa
 * responde, **el cliente no vuelve a rellenar nada**: acepta y paga.
 */
@Schema({ timestamps: true, collection: 'presupuestos' })
export class Presupuesto {
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

  /**
   * Lo que pidió el cliente, tal cual: origen, destino, fecha, mascota,
   * necesidades. Es lo que permite convertir el presupuesto en reserva sin
   * volver a preguntar, y lo que la empresa necesita para poner un precio.
   */
  @Prop({ type: Object, required: true })
  solicitud!: Record<string, unknown>;

  @Prop({ required: true })
  fechaServicio!: Date;

  @Prop({ type: String, enum: EstadoPresupuesto, default: EstadoPresupuesto.SOLICITADO })
  estado!: EstadoPresupuesto;

  /** Importe ofertado por la empresa, con IVA incluido como todo en Doogking. */
  @Prop({ type: Number })
  importe?: number;

  @Prop({ default: MONEDA_DEFAULT })
  moneda!: string;

  @Prop({ type: String })
  condiciones?: string;

  /** Hasta cuándo se puede aceptar la oferta sin volver a pedirla. */
  @Prop({ type: Date })
  validoHasta?: Date;

  @Prop({ type: String })
  motivoRechazo?: string;

  /** Reserva creada al aceptar; es lo que cierra el ciclo. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  @Prop({ type: Date })
  ofertadoAt?: Date;

  @Prop({ type: Date })
  resueltoAt?: Date;
}

export const PresupuestoSchema = SchemaFactory.createForClass(Presupuesto);

// "Mis presupuestos": los del cliente, el último primero.
PresupuestoSchema.index({ usuarioId: 1, estado: 1, createdAt: -1 });
// Bandeja del comercio: lo pendiente de responder, lo más urgente arriba.
PresupuestoSchema.index({ comercioId: 1, estado: 1, createdAt: 1 });
