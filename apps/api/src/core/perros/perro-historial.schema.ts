import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { TipoHistorial, VerticalKey } from 'shared';

export type PerroHistorialDocument = HydratedDocument<PerroHistorial>;

/**
 * Nota que un profesional deja en la ficha del perro tras un servicio
 * (comportamiento real, tiempo empleado, necesidades detectadas). Se acumula
 * para precalcular precio y dar contexto en próximas reservas.
 */
@Schema({ timestamps: true, collection: 'perro_historial' })
export class PerroHistorial {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Perro', required: true })
  perroId!: Types.ObjectId;

  @Prop({ type: String, enum: VerticalKey, required: true })
  vertical!: VerticalKey;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Reserva' })
  reservaId?: Types.ObjectId;

  /** Categoría de la entrada; gobierna con quién se puede compartir (HU-016). */
  @Prop({ type: String, enum: Object.values(TipoHistorial) })
  tipoHistorial?: TipoHistorial;

  /**
   * Quién escribió la entrada. El propietario puede editar o borrar lo que
   * registran las empresas (HU-015), así que hay que saber de dónde vino.
   */
  @Prop({ type: String, enum: ['comercio', 'propietario'], default: 'comercio' })
  origen!: 'comercio' | 'propietario';

  @Prop({ required: true, trim: true })
  nota!: string;

  @Prop({ type: Object, default: {} })
  datosEstructurados!: Record<string, unknown>;

  // --- Registro de servicio estructurado (docs/PLAN-HISTORIAL-MASCOTAS.md) ---
  /** Encabezado corto del registro ("Revisión anual", "Baño y corte"). */
  @Prop({ trim: true })
  titulo?: string;

  /** Cuándo se prestó el servicio; puede no coincidir con cuándo se anotó. */
  @Prop()
  fechaServicio?: Date;

  @Prop({ trim: true })
  profesional?: string;

  @Prop()
  proximaCita?: Date;

  /** Usuario del comercio que escribió el registro. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  autorId?: Types.ObjectId;

  /** Fecha en que el propietario editó la entrada, si lo hizo. */
  @Prop()
  editadaAt?: Date;
}

export const PerroHistorialSchema = SchemaFactory.createForClass(PerroHistorial);
PerroHistorialSchema.index({ perroId: 1, createdAt: -1 });
PerroHistorialSchema.index({ comercioId: 1, perroId: 1, createdAt: -1 });
