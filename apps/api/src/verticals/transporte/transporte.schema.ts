import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type TransporteDocument = HydratedDocument<Transporte>;

export type TipoVehiculoTransporte = 'van_acondicionada' | 'coche' | 'furgon_climatizado';

export interface ServicioAdicionalTransporte {
  nombre: string;
  precio: number;
}

/**
 * Discriminador del vertical Transporte de animales (Doogking): traslado de
 * mascotas A→B con vehículo acondicionado. Precio por trayecto:
 * tarifaBase + tarifaKm × distancia (+ suplemento de exclusividad si se solicita).
 */
@Schema({ _id: false })
export class Transporte extends Servicio {
  @Prop({ type: String, default: 'van_acondicionada' })
  tipoVehiculo!: TipoVehiculoTransporte;

  @Prop({ type: Number, default: 4 })
  capacidadPerros!: number;

  @Prop({ type: [String], default: [] })
  zonaCobertura!: string[];

  @Prop({ type: Number, required: true })
  tarifaBase!: number;

  @Prop({ type: Number, required: true })
  tarifaKm!: number;

  @Prop({ type: Boolean, default: true })
  jaulasIncluidas!: boolean;

  @Prop({ type: Boolean, default: false })
  acompananteHumano!: boolean;

  @Prop({ type: Boolean, default: true })
  soloPerros!: boolean;

  /** Vehículos disponibles ahora mismo (modelo por trayecto). */
  @Prop({ type: Number, default: 1 })
  unidadesDisponibles!: number;

  // --- Enriquecimiento Fase C (docs/mejora_servicios.md §4.1) ---

  /** Tipos de trayecto que ofrece (local_urbano, provincial, nacional, internacional,
   * recogida_peluqueria, recogida_residencia, traslado_veterinario, traslado_urgente_veterinario,
   * traslado_aeropuerto, compartido, exclusivo…). */
  @Prop({ type: [String], default: [] })
  tiposTransporteOfrecidos!: string[];

  /** Suplemento €/trayecto si el cliente solicita transporte exclusivo (docs: +20€ ejemplo). */
  @Prop({ type: Number })
  precioExclusivo?: number;

  @Prop({ type: Boolean, default: false })
  requisitoMicrochip!: boolean;

  @Prop({ type: Boolean, default: false })
  requisitoVacunas!: boolean;

  /** climatizacion, gps, separacion_individual, puerta_a_puerta, paradas_programadas, recogida_central… */
  @Prop({ type: [String], default: [] })
  caracteristicasVehiculo!: string[];

  @Prop({ type: [Object], default: [] })
  serviciosAdicionales!: ServicioAdicionalTransporte[];
}

export const TransporteSchema = SchemaFactory.createForClass(Transporte);
