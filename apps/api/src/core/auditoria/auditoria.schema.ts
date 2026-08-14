import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { EntidadAuditada } from 'shared';

export type RegistroAuditoriaDocument = HydratedDocument<RegistroAuditoria>;

/**
 * Quién hizo qué y cuándo dentro del panel de administración (TCK-8030 §8,
 * TCK-8034 y TCK-8035 §9). Es una colección de sólo escritura: nada la edita
 * después, porque un historial que se puede retocar no sirve como historial.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'auditoria' })
export class RegistroAuditoria {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  actorId!: Types.ObjectId;

  /** Copia del nombre: si el administrador se da de baja, el registro sigue leyéndose. */
  @Prop({ required: true })
  actorNombre!: string;

  @Prop({ type: String, enum: Object.values(EntidadAuditada), required: true, index: true })
  entidad!: EntidadAuditada;

  @Prop({ index: true })
  entidadId?: string;

  /** Qué se hizo, en una frase ya redactada para leerse en el panel. */
  @Prop({ required: true })
  descripcion!: string;

  /** Obligatorio en las acciones que perjudican a alguien (rechazos, suspensiones). */
  @Prop()
  motivo?: string;

  @Prop({ type: Object })
  antes?: Record<string, unknown>;

  @Prop({ type: Object })
  despues?: Record<string, unknown>;
}

export const RegistroAuditoriaSchema = SchemaFactory.createForClass(RegistroAuditoria);

// El panel entra por entidad y ordena por fecha (ESR).
RegistroAuditoriaSchema.index({ entidad: 1, createdAt: -1 });
