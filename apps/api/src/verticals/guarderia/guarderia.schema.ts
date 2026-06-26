import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type GuarderiaDocument = HydratedDocument<Guarderia>;

export type ModalidadGuarderia = 'hora' | 'dia' | 'mes';

/** Discriminador del vertical Guardería: cupo de cuidado infantil por edad. */
@Schema({ _id: false })
export class Guarderia extends Servicio {
  @Prop({ type: Number, default: 0 })
  rangoEdadMin!: number;

  @Prop({ type: Number, default: 12 })
  rangoEdadMax!: number;

  @Prop({ type: Number, default: 0 })
  cuposTotales!: number;

  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;

  @Prop({ type: String, default: 'dia' })
  modalidad!: ModalidadGuarderia;

  @Prop({ type: Number, default: 0 })
  precioHora!: number;

  @Prop({ type: Number, default: 0 })
  precioDia!: number;

  @Prop({ type: Number, default: 0 })
  precioMes!: number;

  @Prop()
  horario?: string;
}

export const GuarderiaSchema = SchemaFactory.createForClass(Guarderia);
