import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type AdiestramientoDocument = HydratedDocument<Adiestramiento>;

export type ModalidadAdiestramiento = 'sesion' | 'programa';
export type TipoServicioAdiestramiento = 'valoracion' | 'individual' | 'grupal' | 'curso' | 'especial';
export type LugarAdiestramiento = 'centro' | 'domicilio' | 'online';
export type ModalidadValoracion = 'presencial' | 'online' | 'domicilio';

/** Catálogo de servicios/técnicas configurable por checkbox (docs/mejora_servicios.md §3.1). */
export interface ServicioAdiestramiento {
  nombre: string;
  tipo: TipoServicioAdiestramiento;
  precio: number;
  duracionMin?: number;
  maxPerros?: number;
  edadMinimaMeses?: number;
  edadMaximaMeses?: number;
  lugar?: LugarAdiestramiento;
  materialNecesario?: string;
}

export interface ValoracionInicial {
  modalidad: ModalidadValoracion;
  precio: number;
}

/** Discriminador del vertical Adiestramiento canino: sesiones o programas con cupos. */
@Schema({ _id: false })
export class Adiestramiento extends Servicio {
  @Prop({ type: [String], default: [] })
  tiposAdiestramiento!: string[];

  /** Catálogo detallado de servicios (precio/duración/edad/lugar propios), Fase C. */
  @Prop({ type: [Object], default: [] })
  serviciosAdiestramiento!: ServicioAdiestramiento[];

  @Prop({ type: Object })
  valoracionInicial?: ValoracionInicial;

  @Prop({ type: String, default: 'sesion' })
  modalidad!: ModalidadAdiestramiento;

  @Prop({ required: true, type: Number })
  precioSesion!: number;

  @Prop({ type: Number })
  precioPrograma?: number;

  @Prop({ type: Number })
  sesionesPorPrograma?: number;

  @Prop({ type: Number, default: 3 })
  edadMinimaMeses!: number;

  @Prop({ default: false })
  aDomicilio!: boolean;

  @Prop({ type: Number, default: 6 })
  capacidadPorSesion!: number;

  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;

  @Prop()
  horario?: string;
}

export const AdiestramientoSchema = SchemaFactory.createForClass(Adiestramiento);
