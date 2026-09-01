import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type AdiestramientoDocument = HydratedDocument<Adiestramiento>;

export type ModalidadAdiestramiento = 'sesion' | 'programa';
export type TipoServicioAdiestramiento = 'individual' | 'grupal' | 'curso' | 'especial';
export type LugarAdiestramiento = 'centro' | 'domicilio' | 'online';
export type ModalidadValoracion = 'presencial' | 'online' | 'domicilio';
/** Un curso puede durar minutos, horas, días o meses: el centro elige la unidad. */
export type UnidadDuracionAdiestramiento = 'minutos' | 'horas' | 'dias' | 'meses';

/** Catálogo de servicios/técnicas configurable por checkbox (docs/mejora_servicios.md §3.1). */
export interface ServicioAdiestramiento {
  nombre: string;
  tipo: TipoServicioAdiestramiento;
  precio: number;
  /** Duración normalizada a minutos: es la que usan disponibilidad y agenda. */
  duracionMin?: number;
  /** Duración tal y como la declara el centro (2 horas, 3 meses…). */
  duracionValor?: number;
  duracionUnidad?: UnidadDuracionAdiestramiento;
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

  /**
   * Valoración inicial por modalidad: el centro publica el precio de las que
   * ofrece (una, dos o las tres) y omite las que no.
   */
  @Prop({ type: [Object], default: [] })
  valoracionesIniciales!: ValoracionInicial[];

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

}

export const AdiestramientoSchema = SchemaFactory.createForClass(Adiestramiento);
