import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { ProveedorCalendario } from './calendar-connector.interface';

export type AgendaDocument = HydratedDocument<Agenda>;
export type RecursoDocument = HydratedDocument<Recurso>;
export type BloqueoDocument = HydratedDocument<Bloqueo>;

/** Franja de trabajo de un día. Dos franjas el mismo día = jornada partida. */
export interface FranjaHoraria {
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** `HH:mm` en la zona horaria de la agenda. */
  desde: string;
  hasta: string;
}

/**
 * Agenda de un trabajador concreto del comercio (HU-050).
 *
 * Existe porque un comercio no es una sola disponibilidad: dos peluqueros del
 * mismo salón atienden en paralelo, y un cupo único no puede representar eso.
 */
@Schema({ timestamps: true, collection: 'agendas' })
export class Agenda {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  /** Usuario del staff dueño de la agenda; vacío = agenda general del comercio. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  trabajadorId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombre!: string;

  /** Jornada semanal, admitiendo varias franjas por día (jornada partida). */
  @Prop({ type: [Object], default: [] })
  franjas!: FranjaHoraria[];

  /** Minutos de margen entre citas: limpieza, desplazamiento, respiro. */
  @Prop({ type: Number, default: 0 })
  margenMinutos!: number;

  /** Zona horaria IANA; sin ella una cita a las 10:00 no significa nada. */
  @Prop({ default: 'Europe/Madrid' })
  zonaHoraria!: string;

  @Prop({ type: Boolean, default: true })
  activa!: boolean;

  // --- Sincronización con calendario externo (HU-049) ---
  @Prop({ type: String, enum: ['google', 'microsoft'] })
  proveedor?: ProveedorCalendario;

  /**
   * Tokens del proveedor. **Nunca se devuelven al cliente**: las consultas de
   * agenda los excluyen explícitamente con `.select()`.
   */
  @Prop({ type: Object, select: false })
  tokens?: { accessToken: string; refreshToken?: string; expiraEn: Date };

  @Prop()
  ultimaSincronizacion?: Date;
}

export const AgendaSchema = SchemaFactory.createForClass(Agenda);
AgendaSchema.index({ comercioId: 1, activa: 1 });
AgendaSchema.index({ trabajadorId: 1 }, { sparse: true });

/**
 * Recurso reservable que no es una persona: una habitación, un vehículo, una
 * mesa de grooming (HU-050). Se reserva igual que una agenda, pero su capacidad
 * es física y no admite solapamiento.
 */
@Schema({ timestamps: true, collection: 'recursos' })
export class Recurso {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ type: String, enum: ['habitacion', 'vehiculo', 'mesa', 'sala', 'otro'], default: 'otro' })
  tipo!: string;

  /** Unidades idénticas de este recurso; 1 = pieza única. */
  @Prop({ type: Number, default: 1 })
  unidades!: number;

  @Prop({ type: Boolean, default: true })
  activo!: boolean;
}

export const RecursoSchema = SchemaFactory.createForClass(Recurso);
RecursoSchema.index({ comercioId: 1, activo: 1 });

/**
 * Franja no disponible. Unifica dos orígenes que deben tratarse igual: los
 * bloqueos manuales del comercio y los eventos traídos del calendario externo.
 */
@Schema({ timestamps: true, collection: 'bloqueos' })
export class Bloqueo {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Agenda', required: true })
  agendaId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  inicio!: Date;

  @Prop({ type: Date, required: true })
  fin!: Date;

  @Prop({ default: '' })
  motivo!: string;

  /** Id en el proveedor; permite reconciliar sin duplicar en cada sincronización. */
  @Prop()
  externalEventId?: string;

  @Prop({ type: String, enum: ['manual', 'externo'], default: 'manual' })
  origen!: 'manual' | 'externo';
}

export const BloqueoSchema = SchemaFactory.createForClass(Bloqueo);
BloqueoSchema.index({ agendaId: 1, inicio: 1, fin: 1 });
// Un evento externo solo puede estar una vez por agenda.
BloqueoSchema.index(
  { agendaId: 1, externalEventId: 1 },
  { unique: true, partialFilterExpression: { externalEventId: { $exists: true } } },
);
