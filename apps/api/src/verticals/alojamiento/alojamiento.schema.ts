import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type AlojamientoDocument = HydratedDocument<Alojamiento>;

export interface EspacioCanino {
  id?: string;
  tipo: string; // 'suite' | 'estandar' | 'compartido' | 'premium' | 'climatizada'
  /** Opcional: algunas residencias no diferencian por tamaño (docs/mejora_servicios.md §2.1). */
  tamanoMaxPerro?: string; // 'mini' | 'pequeno' | 'mediano' | 'grande' | 'gigante'
  descripcion?: string;
  precioNoche: number;
  precioAnterior?: number;
  amenities?: string[];
  imagenes?: string[];
  cantidad: number;
  disponible?: boolean;
  cancelacionGratis?: boolean;
}

export interface ServicioAdicionalResidencia {
  nombre: string;
  precio: number;
}

@Schema({ _id: false })
export class Alojamiento extends Servicio {
  @Prop({ type: [Object], default: [] })
  espacios!: EspacioCanino[];

  @Prop({ type: [String], default: [] })
  amenities!: string[];

  @Prop()
  checkIn?: string;

  @Prop()
  checkOut?: string;

  @Prop()
  politicaCancelacion?: string;

  @Prop({ default: true })
  requisitoVacunas!: boolean;

  @Prop({ default: false })
  paseosIncluidos!: boolean;

  @Prop({ default: false })
  camaras24h!: boolean;

  @Prop({ type: Number, default: 0 })
  espaciosDisponibles!: number;

  @Prop({ type: Number })
  precioAnterior?: number;

  @Prop({ type: Number })
  descuentoPct?: number;

  @Prop({ default: true })
  cancelacionGratis!: boolean;

  @Prop()
  barrio?: string;

  @Prop()
  direccion?: string;

  // --- Enriquecimiento Fase C (docs/mejora_servicios.md §2) ---

  /** Perfiles de compatibilidad social que esta residencia puede alojar. Vacío/ausente = cualquiera. */
  @Prop({ type: [String], default: [] })
  compatibilidadSocialAdmitida!: string[];

  @Prop({ type: Boolean, default: false })
  requisitoMicrochip!: boolean;

  @Prop({ type: Boolean, default: false })
  requiereDesparasitacionInterna!: boolean;

  @Prop({ type: Boolean, default: false })
  requiereDesparasitacionExterna!: boolean;

  @Prop({ type: Boolean, default: false })
  requiereVacunaTosPerreras!: boolean;

  @Prop({ type: [Object], default: [] })
  serviciosAdicionales!: ServicioAdicionalResidencia[];
}

export const AlojamientoSchema = SchemaFactory.createForClass(Alojamiento);
