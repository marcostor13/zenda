import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { EstadoModeracion, TipoLugar } from 'shared';

export type LugarDocument = HydratedDocument<Lugar>;

/**
 * Lugar pet-friendly de la comunidad: playas, parques, restaurantes, rutas.
 *
 * **No es un servicio reservable ni comisionable** (decisión D-5): vive fuera
 * del catálogo para no contaminar el motor de reservas con entidades que no
 * tienen disponibilidad ni precio. Su valor es traer tráfico y devolverlo al
 * marketplace: cada ficha enlaza los servicios de Doogking cercanos.
 */
@Schema({ timestamps: true, collection: 'lugares' })
export class Lugar {
  @Prop({ type: String, enum: Object.values(TipoLugar), required: true })
  tipo!: TipoLugar;

  @Prop({ required: true, trim: true })
  nombre!: string;

  @Prop({ default: '' })
  descripcion!: string;

  @Prop({ type: [String], default: [] })
  fotos!: string[];

  @Prop({
    type: {
      ciudad: { type: String, required: true },
      provincia: { type: String },
      direccion: { type: String },
      geo: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number], default: undefined },
      },
    },
    required: true,
  })
  ubicacion!: {
    ciudad: string;
    provincia?: string;
    direccion?: string;
    geo?: { type: 'Point'; coordinates: [number, number] };
  };

  /**
   * Atributos propios de cada tipo (vallado y agility en un parque; duchas y
   * normativa en una playa; terraza y bebederos en un restaurante). Se guardan
   * sin tipar porque cambian por tipo y los aporta la comunidad.
   */
  @Prop({ type: Object, default: {} })
  atributos!: Record<string, unknown>;

  @Prop({ type: Number, default: 0 })
  ratingPromedio!: number;

  @Prop({ type: Number, default: 0 })
  totalReviews!: number;

  /** Nada se publica sin aprobación de un administrador (HU-045). */
  @Prop({ type: String, enum: Object.values(EstadoModeracion), default: EstadoModeracion.PENDIENTE })
  estado!: EstadoModeracion;

  @Prop()
  motivoRechazo?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario' })
  creadoPor?: Types.ObjectId;
}

export const LugarSchema = SchemaFactory.createForClass(Lugar);

LugarSchema.index({ 'ubicacion.geo': '2dsphere' }, { sparse: true });
LugarSchema.index({ estado: 1, tipo: 1, 'ubicacion.provincia': 1, ratingPromedio: -1 });
LugarSchema.index({ estado: 1, createdAt: -1 });
