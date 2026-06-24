import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';
import { VerticalKey } from 'shared';

export type HotelDocument = HydratedDocument<Hotel>;

export interface Habitacion {
  tipo: string;
  capacidad: number;
  precio: number;
  cantidad: number;
}

@Schema({ _id: false })
export class Hotel extends Servicio {
  @Prop({ type: [Object], default: [] })
  habitaciones!: Habitacion[];

  @Prop({ type: [String], default: [] })
  amenities!: string[];

  @Prop()
  politicaCancelacion?: string;

  @Prop()
  checkIn?: string;

  @Prop()
  checkOut?: string;
}

export const HotelSchema = SchemaFactory.createForClass(Hotel);

HotelSchema.add({ vertical: { type: String, default: VerticalKey.HOTELES } });
