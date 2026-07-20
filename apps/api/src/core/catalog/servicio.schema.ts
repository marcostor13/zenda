import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { VerticalKey, TamanoPerro, TipoPelo } from 'shared';

export type ServicioDocument = HydratedDocument<Servicio>;

export type EstadoServicio = 'borrador' | 'publicado' | 'pausado';

/**
 * Requisitos de aptitud declarados por el comercio (motor de compatibilidad
 * servicio↔perro, docs/mejora_servicios.md §7). Un array vacío/ausente
 * significa "sin restricción" en ese eje.
 */
export interface AptitudPerro {
  tamanosAdmitidos?: TamanoPerro[];
  tipoPeloAdmitido?: TipoPelo[];
  temperamentosNoAdmitidos?: string[];
}

@Schema({ timestamps: true, collection: 'servicios', discriminatorKey: 'vertical' })
export class Servicio {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio', required: true })
  comercioId!: Types.ObjectId;

  // `vertical` es el discriminatorKey: Mongoose lo gestiona automáticamente.
  // No debe declararse como @Prop, o los discriminadores (Hotel, Taxi, …)
  // fallan al registrarse con "cannot have field with name vertical".
  vertical!: VerticalKey;

  @Prop({ required: true })
  titulo!: string;

  @Prop({ required: true })
  descripcion!: string;

  @Prop({ type: [String], default: [] })
  imagenes!: string[];

  @Prop({
    type: {
      ciudad: { type: String, required: true },
      geo: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined },
      },
    },
  })
  ubicacion!: {
    ciudad: string;
    geo?: { type: 'Point'; coordinates: [number, number] };
  };

  @Prop({ required: true, type: Number })
  precioBase!: number;

  @Prop({ default: 'EUR' })
  moneda!: string;

  @Prop({ default: false })
  destacado!: boolean;

  @Prop({ default: 0 })
  prioridadRanking!: number;

  @Prop({ type: String, enum: ['borrador', 'publicado', 'pausado'], default: 'borrador' })
  estado!: EstadoServicio;

  @Prop({ default: 0 })
  ratingPromedio!: number;

  @Prop({ default: 0 })
  totalReseñas!: number;

  @Prop({ type: Object })
  aptitud?: AptitudPerro;
}

export const ServicioSchema = SchemaFactory.createForClass(Servicio);

ServicioSchema.index({ vertical: 1, 'ubicacion.ciudad': 1, prioridadRanking: -1, precioBase: 1 });
ServicioSchema.index({ 'ubicacion.geo': '2dsphere' }, { sparse: true });
