import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ModoPrecioClinico, ServicioClinicoTipo } from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type VeterinariaDocument = HydratedDocument<Veterinaria>;

/** Una vacuna concreta o un tramo de peso, con su propio importe. */
export interface VarianteServicioClinico {
  nombre: string;
  precio: number;
}

/** Extra opcional que el cliente puede añadir al reservar (analítica previa…). */
export interface ComplementoServicioClinico {
  nombre: string;
  precio: number;
}

export interface ServicioClinico {
  /**
   * Servicio del catálogo cerrado. Es la fuente de verdad desde la Ola 4:
   * `nombre` queda como texto heredado de los listados antiguos.
   */
  tipo?: ServicioClinicoTipo;
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

  /**
   * Cómo se calcula el importe. Sin él se asume `fijo`, que es lo que guardaban
   * los listados anteriores al catálogo.
   */
  modoPrecio?: ModoPrecioClinico;

  /**
   * Desglose del precio cuando no es único: cada vacuna con la suya, cada tramo
   * de peso con el suyo. El cliente no reserva «vacunación», reserva «vacuna de
   * la rabia — 32 €», que es lo que puede pagar por adelantado.
   */
  variantes?: VarianteServicioClinico[];

  /** Qué entra en el precio, y qué no. Decisivo en cirugías y packs. */
  incluye?: string;
  noIncluye?: string;

  /** Extras que el cliente puede sumar al reservar, cada uno con su importe. */
  complementos?: ComplementoServicioClinico[];
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


  @Prop({ required: true, type: Number })
  precioConsulta!: number;
}

export const VeterinariaSchema = SchemaFactory.createForClass(Veterinaria);
