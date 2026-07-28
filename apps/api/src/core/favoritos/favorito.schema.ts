import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { TipoFavorito } from 'shared';

export type FavoritoDocument = HydratedDocument<Favorito>;

/**
 * Algo marcado como favorito por un usuario (❤️): un servicio reservable o un
 * lugar de la comunidad. Se comparte colección a propósito (§6.2 del plan
 * unificado): son la misma acción del usuario, y duplicarla en dos colecciones
 * obligaría a consultar dos veces para pintar una sola lista.
 *
 * Un usuario no puede marcar dos veces lo mismo: índices únicos parciales.
 */
@Schema({ timestamps: true, collection: 'favoritos' })
export class Favorito {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TipoFavorito), default: TipoFavorito.SERVICIO })
  tipo!: TipoFavorito;

  /** Presente cuando `tipo` es `servicio`. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Servicio' })
  servicioId?: Types.ObjectId;

  /** Precio del servicio en el momento de guardarlo como favorito (HU-10.4); no se actualiza nunca. */
  @Prop({ type: Number })
  precioGuardado?: number;

  /** Presente cuando `tipo` es `lugar`. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Lugar' })
  lugarId?: Types.ObjectId;
}

export const FavoritoSchema = SchemaFactory.createForClass(Favorito);

FavoritoSchema.index(
  { usuarioId: 1, servicioId: 1 },
  { unique: true, partialFilterExpression: { servicioId: { $exists: true } } },
);
FavoritoSchema.index(
  { usuarioId: 1, lugarId: 1 },
  { unique: true, partialFilterExpression: { lugarId: { $exists: true } } },
);
FavoritoSchema.index({ usuarioId: 1, tipo: 1, createdAt: -1 });
