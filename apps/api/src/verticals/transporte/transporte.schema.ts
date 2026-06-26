import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type TransporteDocument = HydratedDocument<Transporte>;

/** Discriminador del vertical Transporte de carga: por ruta + peso/volumen. */
@Schema({ _id: false })
export class Transporte extends Servicio {
  @Prop()
  tipoCarga?: string;

  @Prop({ type: Number, default: 0 })
  capacidadKg!: number;

  @Prop({ type: Number, default: 0 })
  capacidadM3!: number;

  @Prop({ type: [String], default: [] })
  rutasCubiertas!: string[];

  @Prop({ type: Number, required: true })
  tarifaBase!: number;

  @Prop({ type: Number, required: true })
  tarifaKg!: number;
}

export const TransporteSchema = SchemaFactory.createForClass(Transporte);
