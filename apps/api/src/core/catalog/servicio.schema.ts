import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { VerticalKey } from 'shared';

export type ServicioDocument = HydratedDocument<Servicio>;

export type EstadoServicio = 'borrador' | 'publicado' | 'pausado';

@Schema({ timestamps: true, collection: 'servicios', discriminatorKey: 'vertical' })
export class Servicio {
  @Prop({ type: Types.ObjectId, ref: 'Comercio', required: true })
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
}

export const ServicioSchema = SchemaFactory.createForClass(Servicio);

ServicioSchema.index({ vertical: 1, 'ubicacion.ciudad': 1, prioridadRanking: -1, precioBase: 1 });
ServicioSchema.index({ 'ubicacion.geo': '2dsphere' }, { sparse: true });
