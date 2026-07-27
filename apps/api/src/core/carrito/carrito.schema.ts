import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey } from 'shared';

export type CarritoDocument = HydratedDocument<Carrito>;

export type EstadoCarrito = 'abierto' | 'procesando' | 'confirmado' | 'abandonado';

/**
 * Un servicio añadido al viaje. **No reserva plaza**: el bloqueo de
 * disponibilidad se toma en el checkout, no mientras el usuario navega. Así un
 * carrito abandonado no deja inventario retenido durante horas.
 */
export interface ItemCarrito {
  itemId: string;
  servicioId: Types.ObjectId;
  comercioId: Types.ObjectId;
  vertical: VerticalKey;
  /** Título del servicio en el momento de añadirlo, para el resumen del carrito. */
  titulo: string;
  fechaInicio: Date;
  fechaFin?: Date;
  cantidad: number;
  perroIds: string[];
  detalle: Record<string, unknown>;
  /** Importe estimado al añadirlo; se recalcula al reservar de verdad. */
  precioEstimado: number;
  /** El alojamiento del viaje: se usa como reserva madre al confirmar. */
  esReservaMadre: boolean;
}

/**
 * Carrito multi-vertical (HU-033). Por fuera es un único viaje; por dentro,
 * cada item acabará siendo **su propia reserva**, con su comercio, su precio,
 * su comisión, su disponibilidad y su política de cancelación (decisión D-1).
 */
@Schema({ timestamps: true, collection: 'carritos' })
export class Carrito {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: String, enum: ['abierto', 'procesando', 'confirmado', 'abandonado'], default: 'abierto' })
  estado!: EstadoCarrito;

  @Prop({ type: [Object], default: [] })
  items!: ItemCarrito[];

  /** Reservas creadas en el checkout, para poder retomar un pago a medias. */
  @Prop({ type: [SchemaTypes.ObjectId], ref: 'Reserva', default: [] })
  reservaIds!: Types.ObjectId[];

  /** TTL: un carrito abierto caduca a las 24 h y deja de contar como activo. */
  @Prop({ type: Date, required: true })
  expiraEn!: Date;
}

export const CarritoSchema = SchemaFactory.createForClass(Carrito);

CarritoSchema.index({ usuarioId: 1, estado: 1 });
CarritoSchema.index({ expiraEn: 1 }, { expireAfterSeconds: 0 });
