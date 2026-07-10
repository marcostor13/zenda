import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Servicio } from '../../core/catalog/servicio.schema';

export type AlojamientoDocument = HydratedDocument<Alojamiento>;

export interface EspacioCanino {
  id?: string;
  tipo: string; // 'suite' | 'estandar' | 'compartido'
  tamanoMaxPerro: string; // 'pequeno' | 'mediano' | 'grande' | 'gigante'
  descripcion?: string;
  precioNoche: number;
  precioAnterior?: number;
  amenities?: string[];
  imagenes?: string[];
  cantidad: number;
  disponible?: boolean;
  cancelacionGratis?: boolean;
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
}

export const AlojamientoSchema = SchemaFactory.createForClass(Alojamiento);
