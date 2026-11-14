import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { PagoEstado, PagoPasarela, MONEDA_DEFAULT } from 'shared';

export type PagoDocument = HydratedDocument<Pago>;

@Schema({ timestamps: true, collection: 'pagos' })
export class Pago {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva', required: true })
  reservaId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: String, enum: PagoPasarela, default: PagoPasarela.STRIPE })
  pasarela!: PagoPasarela;

  @Prop({ required: true, type: Number })
  montoTotal!: number;

  @Prop({ default: MONEDA_DEFAULT })
  moneda!: string;

  // Desglose financiero visible en el admin
  @Prop({ required: true, type: Number })
  montoSubtotal!: number;

  @Prop({ required: true, type: Number })
  ivaMonto!: number;

  @Prop({ required: true, type: Number })
  comisionPlataforma!: number;

  @Prop({ required: true, type: Number })
  stripeFee!: number;

  @Prop({ required: true, type: Number })
  montoLiquidacion!: number; // lo que recibe el comercio

  /**
   * Lo que pone la plataforma por un cupón que asume ella (ya sumado a
   * `montoLiquidacion`). Es coste de Doogking: el margen neto lo resta.
   */
  @Prop({ type: Number, default: 0 })
  descuentoPlataforma!: number;

  @Prop({ type: String, enum: PagoEstado, default: PagoEstado.INICIADO })
  estado!: PagoEstado;

  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  stripeChargeId?: string;

  @Prop({ type: Object })
  stripeMetadata?: Record<string, unknown>;

  // Cargo por la diferencia de un ajuste de precio aceptado (ver docs/mejora_servicios.md §7).
  @Prop({ type: Boolean, default: false })
  esSuplemento!: boolean;

  /**
   * Pago único de un viaje multi-vertical (Ola 5). `reservaId` apunta a la
   * primera reserva por compatibilidad, pero al aprobarse se confirman **todas**
   * las de esta lista. Vacío en un pago normal de una sola reserva.
   */
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Reserva', default: [] })
  reservaIds!: Types.ObjectId[];

  /**
   * Desglose reserva a reserva de un pago de viaje. Cada línea es de un
   * comercio distinto y es lo que hay que liquidarle: sin esto, todo el cobro
   * se atribuía al comercio de `reservaId` (la primera) y los demás no cobraban.
   * Vacío en un pago normal; ahí la única línea son los totales del propio pago.
   */
  @Prop({
    type: [{
      _id: false,
      reservaId: { type: SchemaTypes.ObjectId, ref: 'Reserva' },
      montoTotal: Number,
      montoSubtotal: Number,
      ivaMonto: Number,
      comisionPlataforma: Number,
      stripeFee: Number,
      montoLiquidacion: Number,
      descuentoPlataforma: { type: Number, default: 0 },
      importeReembolsado: { type: Number, default: 0 },
    }],
    default: [],
  })
  lineas!: LineaPago[];

  /**
   * Se dio por cobrado sin pasar por la pasarela, para poder probar el flujo de
   * reserva de punta a punta (ver `PAGOS_BYPASS`).
   *
   * Queda marcado en el propio pago porque, sin esto, una reserva de prueba es
   * indistinguible de una real: aparecería en las liquidaciones del comercio
   * como dinero que hay que pagarle.
   */
  @Prop({ type: Boolean, default: false })
  esPrueba!: boolean;

  /** Lo devuelto hasta ahora; una cancelación tardía puede devolver sólo una parte. */
  @Prop({ type: Number, default: 0 })
  importeReembolsado!: number;

  /**
   * Lo que la pasarela ha avisado sobre este cobro después de aprobarlo y que
   * alguien tiene que mirar: una devolución que el banco rechazó, una disputa.
   * `referencia` es el id del objeto en Stripe y sirve para no apuntarlo dos
   * veces si el aviso se repite.
   */
  @Prop({
    type: [{ _id: false, tipo: String, detalle: String, referencia: String, fecha: Date }],
    default: [],
  })
  incidencias!: IncidenciaPago[];
}

export interface LineaPago {
  reservaId: Types.ObjectId;
  montoTotal: number;
  montoSubtotal: number;
  ivaMonto: number;
  comisionPlataforma: number;
  stripeFee: number;
  montoLiquidacion: number;
  descuentoPlataforma?: number;
  importeReembolsado?: number;
}

export interface IncidenciaPago {
  tipo: string;
  detalle: string;
  referencia?: string;
  fecha: Date;
}

export const PagoSchema = SchemaFactory.createForClass(Pago);
PagoSchema.index({ reservaId: 1 });
PagoSchema.index({ stripePaymentIntentId: 1 }, { sparse: true, unique: true });
