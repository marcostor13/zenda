import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type VeterinariaDocument = HydratedDocument<Veterinaria>;

export interface ServicioClinico {
  nombre: string;
  precio: number;
  duracionMin?: number;
  /**
   * true = precio cerrado (vacunas, microchip, certificados, revisiones postop…), comisionable normal.
   * false/ausente = precio orientativo ("desde X€": consulta general, dermatología, urgencias…) —
   * Doogking solo comisiona este importe inicial; pruebas/tratamientos extra se facturan fuera de la
   * plataforma (docs/mejora_servicios.md §5.4, decisión ya tomada: excepción de comisión veterinaria).
   */
  esPrecioCerrado?: boolean;
}

/** Discriminador del vertical Veterinaria: citas clínicas, no solo para perros (docs §5.1). */
@Schema({ _id: false })
export class Veterinaria extends Servicio {
  @Prop({ type: [String], default: [] })
  especialidades!: string[];

  @Prop({ type: [Object], default: [] })
  serviciosClinicos!: ServicioClinico[];

  /** Especies que atiende la clínica; ['perro'] por defecto. Vacío = cualquier especie. */
  @Prop({ type: [String], default: ['perro'] })
  especiesAtendidas!: string[];

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
