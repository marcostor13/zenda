import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TamanoPerro } from 'shared';
import { Servicio } from '../../core/catalog/servicio.schema';

export type CuidadoresDocument = HydratedDocument<Cuidadores>;

/** Cómo se cobra el servicio: paseo, visita suelta, día completo o noche. */
export type ModalidadCuidado = 'paseo' | 'visita' | 'dia_completo' | 'noche';

/**
 * Discriminador del vertical Paseadores y cuidado a domicilio (Ref. COMI3).
 *
 * Reserva por cupos diarios, igual que adiestramiento: no necesita una estrategia
 * de disponibilidad nueva. Un mismo profesional puede ofrecer una o varias
 * modalidades (ej. paseos y visitas de cuidado), compartiendo el cupo diario.
 */
@Schema({ _id: false })
export class Cuidadores extends Servicio {
  @Prop({ type: [String], default: ['visita'] })
  modalidades!: ModalidadCuidado[];

  /** Precio de un paseo suelto. */
  @Prop({ type: Number })
  precioPaseo?: number;

  /** Precio de una visita suelta al domicilio del cliente. */
  @Prop({ type: Number })
  precioVisita?: number;

  @Prop({ type: Number })
  precioDiaCompleto?: number;

  @Prop({ type: Number })
  precioNoche?: number;

  /** Duración de un paseo estándar, en minutos. */
  @Prop({ type: Number, default: 30 })
  duracionPaseoMin!: number;

  /** Duración de una visita estándar, en minutos. */
  @Prop({ type: Number, default: 45 })
  duracionVisitaMin!: number;

  /** Servicios que presta durante la visita/paseo (comida, medicación, agua…). */
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

  /** Visitas/paseos que puede atender al día; alimenta el filtro de disponibilidad. */
  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;

  @Prop()
  horario?: string;
}

export const CuidadoresSchema = SchemaFactory.createForClass(Cuidadores);
