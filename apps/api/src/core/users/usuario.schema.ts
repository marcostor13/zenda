import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Rol } from 'shared';

export type UsuarioDocument = HydratedDocument<Usuario>;

@Schema({ timestamps: true, collection: 'usuarios' })
export class Usuario {
  @Prop({ required: true })
  nombre!: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop()
  telefono?: string;

  @Prop({ type: String, enum: Rol, default: Rol.CLIENTE })
  rol!: Rol;

  @Prop({ type: Types.ObjectId, ref: 'Comercio' })
  comercioId?: Types.ObjectId;

  @Prop({ default: false })
  verificado!: boolean;

  @Prop()
  avatarUrl?: string;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

UsuarioSchema.index({ email: 1 }, { unique: true });
