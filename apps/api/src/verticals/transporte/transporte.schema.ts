import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type TransporteDocument = HydratedDocument<Transporte>;

export type TipoVehiculoTransporte = 'van_acondicionada' | 'coche' | 'furgon_climatizado';

/**
 * Discriminador del vertical Transporte de animales (Doogking): traslado de
 * mascotas A→B con vehículo acondicionado. Precio por trayecto:
 * tarifaBase + tarifaKm × distancia.
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
}

export const TransporteSchema = SchemaFactory.createForClass(Transporte);
