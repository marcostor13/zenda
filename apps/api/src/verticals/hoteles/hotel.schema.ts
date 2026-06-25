import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type HotelDocument = HydratedDocument<Hotel>;

export interface Habitacion {
  id?: string;
  tipo: string;
  descripcion?: string;
  capacidad: number;
  camas?: string;
  tamano?: number;
  precio: number;
  precioAnterior?: number;
  amenities?: string[];
  imagenes?: string[];
  cantidad: number;
  disponible?: boolean;
  cancelacionGratis?: boolean;
}

@Schema({ _id: false })
export class Hotel extends Servicio {
  @Prop({ type: [Object], default: [] })
  habitaciones!: Habitacion[];

  @Prop({ type: [String], default: [] })
  amenities!: string[];

  // Atributos de presentación específicos del alojamiento.
  @Prop({ type: Number, default: 3 })
  estrellas!: number;

  @Prop()
  barrio?: string;

  @Prop()
  direccion?: string;

  @Prop({ type: Number })
  precioAnterior?: number;

  @Prop({ type: Number })
  descuentoPct?: number;

  @Prop({ default: false })
  desayunoIncluido!: boolean;

  @Prop({ default: true })
  cancelacionGratis!: boolean;

  @Prop({ type: Number, default: 0 })
  habitacionesDisponibles!: number;

  @Prop()
  politicaCancelacion?: string;

  @Prop()
  checkIn?: string;

  @Prop()
  checkOut?: string;
}

export const HotelSchema = SchemaFactory.createForClass(Hotel);
