import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type AdiestramientoDocument = HydratedDocument<Adiestramiento>;

export type ModalidadAdiestramiento = 'sesion' | 'programa';

/** Discriminador del vertical Adiestramiento canino: sesiones o programas con cupos. */
@Schema({ _id: false })
export class Adiestramiento extends Servicio {
  @Prop({ type: [String], default: [] })
  tiposAdiestramiento!: string[];

  @Prop({ type: String, default: 'sesion' })
  modalidad!: ModalidadAdiestramiento;

  @Prop({ required: true, type: Number })
  precioSesion!: number;

  @Prop({ type: Number })
  precioPrograma?: number;

  @Prop({ type: Number })
  sesionesPorPrograma?: number;

  @Prop({ type: Number, default: 3 })
  edadMinimaMeses!: number;

  @Prop({ default: false })
  aDomicilio!: boolean;

  @Prop({ type: Number, default: 6 })
  capacidadPorSesion!: number;

  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;

  @Prop()
  horario?: string;
}

export const AdiestramientoSchema = SchemaFactory.createForClass(Adiestramiento);
