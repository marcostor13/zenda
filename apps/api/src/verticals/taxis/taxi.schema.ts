import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type TaxiDocument = HydratedDocument<Taxi>;

export type TipoVehiculo = 'sedan' | 'suv' | 'van' | 'premium';

/**
 * Discriminador del vertical Taxis. Aporta los campos propios del servicio de
 * traslado (tarifa base + tarifa por km, zona de cobertura, flota disponible).
 */
@Schema({ _id: false })
export class Taxi extends Servicio {
  @Prop({ type: String, default: 'sedan' })
  tipoVehiculo!: TipoVehiculo;

  @Prop({ type: Number, default: 4 })
  capacidad!: number;

  @Prop({ type: [String], default: [] })
  zonaCobertura!: string[];

  @Prop({ type: Number, required: true })
  tarifaBase!: number;

  @Prop({ type: Number, required: true })
  tarifaKm!: number;

  /** Vehículos disponibles ahora mismo (modelo on-demand). */
  @Prop({ type: Number, default: 0 })
  unidadesDisponibles!: number;
}

export const TaxiSchema = SchemaFactory.createForClass(Taxi);
