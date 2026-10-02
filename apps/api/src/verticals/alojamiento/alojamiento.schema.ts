import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { ConfigGuarderia } from 'shared';
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

  // --- Enriquecimiento Fase C (docs/mejora_servicios.md §2) ---

  /** Perfiles de compatibilidad social que esta residencia puede alojar. Vacío/ausente = cualquiera. */
  @Prop({ type: [String], default: [] })
  compatibilidadSocialAdmitida!: string[];

  /**
   * Conductas de riesgo que esta residencia NO admite (Ref. RES5): agresividad,
   * ansiedad_extrema, tendencia_escapar, destructivo. Vacío/ausente = admite cualquiera
   * (la reserva se avisa/bloquea en `AlojamientoAvailabilityStrategy`, no aquí).
   */
  @Prop({ type: [String], default: [] })
  conductasNoAdmitidas!: string[];

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

  // --- Residencia y guardería canina (observaciones octubre 2026) ---

  /**
   * Qué vende el centro: `residencia` (con noche), `guarderia` (de día) o las
   * dos. Sin valor por defecto a propósito: los alojamientos dados de alta antes
   * no lo traen y se leen como residencia (`modalidadesAlojamiento` en shared).
   */
  @Prop({ type: [String], default: undefined })
  modalidades?: string[];

  /** Precios, plazas por día y horario de la guardería de día. */
  @Prop({ type: Object })
  guarderia?: ConfigGuarderia;
}

export const AlojamientoSchema = SchemaFactory.createForClass(Alojamiento);
