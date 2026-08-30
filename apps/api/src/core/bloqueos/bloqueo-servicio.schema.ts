import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type BloqueoServicioDocument = HydratedDocument<BloqueoServicio>;

/**
 * Un tramo que el comercio cierra en **un servicio suyo**.
 *
 * Va aparte del `Bloqueo` de `core/agenda`, que cierra la agenda de un
 * trabajador o un recurso y se sincroniza con calendarios externos. Éste cierra
 * inventario o huecos de un listado concreto, que es lo que decide si el
 * servicio se puede reservar desde el buscador.
 *
 * Existe porque un negocio no vende sólo por Doogking: si alquila dos suites por
 * teléfono o se va de vacaciones y esas plazas se siguen ofreciendo, acaba con
 * dos reservas para el mismo sitio.
 *
 * Con `cantidad` cierra **parte** del inventario (dos de cinco suites) y sólo
 * resta disponibilidad; sin ella cierra el servicio entero en ese tramo y
 * ninguna reserva lo puede solapar.
 */
@Schema({ timestamps: true, collection: 'bloqueos_servicio' })
export class BloqueoServicio {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Servicio', required: true })
  servicioId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  desde!: Date;

  /** Fin exclusivo: `[desde, hasta)`, igual que una estancia. */
  @Prop({ type: Date, required: true })
  hasta!: Date;

  /**
   * Por qué se cierra. Obligatorio a propósito: dentro de tres semanas nadie
   * recuerda por qué estaba bloqueado ese hueco, y sin el motivo la agenda deja
   * de servir para lo que se creó.
   */
  @Prop({ required: true })
  motivo!: string;

  /** Unidades cerradas. Sin valor, se cierra el servicio entero. */
  @Prop({ type: Number })
  cantidad?: number;

  /** Tipo de espacio afectado; sin él, cuenta sobre el total del servicio. */
  @Prop()
  espacioTipo?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  creadoPor?: Types.ObjectId;
}

export const BloqueoServicioSchema = SchemaFactory.createForClass(BloqueoServicio);

// La consulta que manda es "qué hay cerrado en este servicio entre dos fechas":
// igualdad por servicio y rango por fecha, en ese orden (ESR, CLAUDE.md §4.3).
BloqueoServicioSchema.index({ servicioId: 1, desde: 1, hasta: 1 });
BloqueoServicioSchema.index({ comercioId: 1, desde: 1 });
