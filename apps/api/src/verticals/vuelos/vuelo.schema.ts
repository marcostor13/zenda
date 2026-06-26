import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type VueloDocument = HydratedDocument<Vuelo>;

/** Discriminador del vertical Vuelos: asiento en ruta/horario, inventario de asientos. */
@Schema({ _id: false })
export class Vuelo extends Servicio {
  @Prop({ required: true })
  origen!: string;

  @Prop({ required: true })
  destino!: string;

  @Prop({ type: Date, required: true })
  fechaSalida!: Date;

  @Prop({ type: Date })
  fechaLlegada?: Date;

  @Prop()
  aerolinea?: string;

  @Prop({ type: Number, default: 0 })
  asientosTotales!: number;

  @Prop({ type: Number, default: 0 })
  asientosDisponibles!: number;

  @Prop({ type: Number, required: true })
  precioAsiento!: number;
}

export const VueloSchema = SchemaFactory.createForClass(Vuelo);
