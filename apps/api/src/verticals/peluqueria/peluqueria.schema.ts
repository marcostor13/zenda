import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type PeluqueriaDocument = HydratedDocument<Peluqueria>;

export interface ServicioGrooming {
  nombre: string;
  precio: number;
  duracionMin?: number;
  tamanoPerro?: string;
}

/** Discriminador del vertical Peluquería canina: grooming por citas/slots. */
@Schema({ _id: false })
export class Peluqueria extends Servicio {
  @Prop({ type: [Object], default: [] })
  serviciosGrooming!: ServicioGrooming[];

  @Prop({ type: Number, default: 60 })
  duracionSlotMin!: number;

  @Prop({ type: Number, default: 2 })
  capacidadSimultanea!: number;

  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;

  @Prop({ default: false })
  aDomicilio!: boolean;

  @Prop()
  horario?: string;
}

export const PeluqueriaSchema = SchemaFactory.createForClass(Peluqueria);
