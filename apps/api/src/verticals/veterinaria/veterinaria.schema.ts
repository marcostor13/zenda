import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type VeterinariaDocument = HydratedDocument<Veterinaria>;

export interface ServicioClinico {
  nombre: string;
  precio: number;
  duracionMin?: number;
}

/** Discriminador del vertical Veterinaria: citas clínicas para perros. */
@Schema({ _id: false })
export class Veterinaria extends Servicio {
  @Prop({ type: [String], default: [] })
  especialidades!: string[];

  @Prop({ type: [Object], default: [] })
  serviciosClinicos!: ServicioClinico[];

  @Prop({ type: Number, default: 30 })
  duracionCitaMin!: number;

  @Prop({ type: Number, default: 16 })
  citasPorDia!: number;

  @Prop({ type: Number, default: 0 })
  citasDisponibles!: number;

  @Prop({ default: false })
  atiendeUrgencias!: boolean;

  @Prop()
  horario?: string;

  @Prop({ required: true, type: Number })
  precioConsulta!: number;
}

export const VeterinariaSchema = SchemaFactory.createForClass(Veterinaria);
