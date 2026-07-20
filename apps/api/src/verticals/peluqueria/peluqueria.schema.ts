import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';
import { TamanoPerro, TipoPelo } from 'shared';

export type PeluqueriaDocument = HydratedDocument<Peluqueria>;

export interface PrecioPorTamano {
  tamano: TamanoPerro;
  precio: number;
  duracionMin: number;
}

export interface ServicioGrooming {
  nombre: string;
  precio: number;
  duracionMin?: number;
  tamanoPerro?: string;
  /** Precio/duración específicos por tamaño; si hay coincidencia con el tamaño del
   * perro reservado, tiene prioridad sobre `precio`/`duracionMin` (que quedan como
   * valor por defecto para comercios que no necesitan diferenciar por tamaño). */
  preciosPorTamano?: PrecioPorTamano[];
  /** Tipos de pelo para los que este servicio es apto (ej. stripping solo pelo duro).
   * Vacío/ausente = compatible con cualquier tipo de pelo. */
  tipoPeloCompatible?: TipoPelo[];
}

export type PoliticaTemperamentoDificil = 'aceptar' | 'suplemento' | 'valoracion_previa' | 'rechazar';

export interface ServicioAdicionalPeluqueria {
  nombre: string;
  precio: number;
}

/** Discriminador del vertical Peluquería canina: grooming por citas/slots. */
@Schema({ _id: false })
export class Peluqueria extends Servicio {
  @Prop({ type: [Object], default: [] })
  serviciosGrooming!: ServicioGrooming[];

  @Prop({ type: Number, default: 60 })
  duracionSlotMin!: number;

  @Prop({ type: Number, default: 2 })
  capacidadSimultanea!: number;

  @Prop({ type: Number, default: 0 })
  cuposDisponibles!: number;

  @Prop({ default: false })
  aDomicilio!: boolean;

  @Prop()
  horario?: string;

  // --- Enriquecimiento Fase C (docs/mejora_servicios.md §1) ---

  /** Los suplementos monetarios por estado del manto/temperamento usan el catálogo
   * genérico de suplementos de Fase A (`suplemento_configs`), no un campo propio aquí. */
  @Prop({ type: String, enum: ['aceptar', 'suplemento', 'valoracion_previa', 'rechazar'], default: 'aceptar' })
  politicaTemperamentoDificil!: PoliticaTemperamentoDificil;

  @Prop({ type: Boolean, default: true })
  bozalObligatorioSiAgresivo!: boolean;

  @Prop({ type: [Object], default: [] })
  serviciosAdicionales!: ServicioAdicionalPeluqueria[];

  @Prop({ type: [String], default: [] })
  razasEspecificas!: string[];

  @Prop({ type: Boolean, default: true })
  requiereVacunasAlDia!: boolean;

  @Prop({ type: Boolean, default: true })
  requiereMicrochip!: boolean;
}

export const PeluqueriaSchema = SchemaFactory.createForClass(Peluqueria);
