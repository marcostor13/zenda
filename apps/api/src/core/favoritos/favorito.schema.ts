import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';

export type FavoritoDocument = HydratedDocument<Favorito>;

/**
 * Servicio marcado como favorito por un usuario (❤️). Un usuario no puede
 * marcar dos veces el mismo servicio: índice único compuesto usuario+servicio.
 */
@Schema({ timestamps: true, collection: 'favoritos' })
export class Favorito {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Usuario', required: true })
  usuarioId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Servicio', required: true })
  servicioId!: Types.ObjectId;
}

export const FavoritoSchema = SchemaFactory.createForClass(Favorito);

FavoritoSchema.index({ usuarioId: 1, servicioId: 1 }, { unique: true });
FavoritoSchema.index({ usuarioId: 1, createdAt: -1 });
