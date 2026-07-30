import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ListaEsperaDocument = HydratedDocument<ListaEspera>;

/**
 * Email dejado por un visitante en la pantalla de prelanzamiento para que le
 * avisemos cuando Doogking abra. No es una cuenta: no hay contraseña ni rol, y
 * el usuario puede registrarse después con el mismo email sin conflicto.
 */
@Schema({ timestamps: true, collection: 'lista_espera' })
export class ListaEspera {
  /** Normalizado en minúsculas por el servicio para que el índice único funcione. */
  @Prop({ type: String, required: true, unique: true, trim: true, lowercase: true })
  email!: string;

  /** Pantalla o campaña de origen; sirve para medir qué canal convierte. */
  @Prop({ type: String, default: 'proximamente', trim: true })
  origen!: string;
}

export const ListaEsperaSchema = SchemaFactory.createForClass(ListaEspera);

ListaEsperaSchema.index({ createdAt: -1 });
