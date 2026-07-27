import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TamanoPerro } from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type CuidadoresDocument = HydratedDocument<Cuidadores>;

/** Cómo se cobra el cuidado: por visita suelta o por día completo. */
export type ModalidadCuidado = 'visita' | 'dia_completo' | 'noche';

/**
 * Discriminador del vertical Cuidadores a domicilio (HU-048).
 *
 * Alta ligera sobre el patrón existente: se reserva por cupos diarios, igual
 * que adiestramiento, así que no necesita una estrategia de disponibilidad
 * nueva. **Paseadores queda explícitamente fuera de alcance.**
 */
@Schema({ _id: false })
export class Cuidadores extends Servicio {
  @Prop({ type: [String], default: ['visita'] })
  modalidades!: ModalidadCuidado[];

  /** Precio de una visita suelta al domicilio del cliente. */
  @Prop({ type: Number, required: true })
  precioVisita!: number;

  @Prop({ type: Number })
  precioDiaCompleto?: number;

  @Prop({ type: Number })
  precioNoche?: number;

  /** Duración de una visita estándar, en minutos. */
  @Prop({ type: Number, default: 45 })
  duracionVisitaMin!: number;

  /** Servicios que presta durante la visita (comida, medicación, paseo…). */
  @Prop({ type: [String], default: [] })
  tareasIncluidas!: string[];

  @Prop({ type: [String], enum: Object.values(TamanoPerro), default: [] })
  tamanosAdmitidos!: TamanoPerro[];

  @Prop({ type: Boolean, default: false })
  aceptaPPP!: boolean;

  @Prop({ type: Boolean, default: false })
  administraMedicacion!: boolean;

  /** Radio de desplazamiento desde su ciudad base, en km. */
  @Prop({ type: Number, default: 10 })
  radioDesplazamientoKm!: number;

  /** Visitas que puede atender al día; alimenta el filtro de disponibilidad. */
  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;

  @Prop()
  horario?: string;
}

export const CuidadoresSchema = SchemaFactory.createForClass(Cuidadores);
