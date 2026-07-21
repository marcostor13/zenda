import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, SchemaTypes } from 'mongoose';
import { Rol } from 'shared';

export type UsuarioDocument = HydratedDocument<Usuario>;

@Schema({ timestamps: true, collection: 'usuarios' })
export class Usuario {
  @Prop({ required: true })
  nombre!: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email!: string;

  // Opcional: las cuentas creadas solo con Google/Meta no tienen contraseña local.
  @Prop()
  passwordHash?: string;

  // Proveedores de identidad vinculados a la cuenta: 'local' | 'google' | 'facebook'.
  @Prop({ type: [String], default: [] })
  proveedores!: string[];

  @Prop()
  telefono?: string;

  @Prop({ type: String, enum: Rol, default: Rol.CLIENTE })
  rol!: Rol;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Comercio' })
  comercioId?: Types.ObjectId;

  // Puesto del miembro del equipo del comercio (gerente, recepción, peluquero…).
  @Prop()
  puesto?: string;

  @Prop({ default: false })
  verificado!: boolean;

  // Bloquea el acceso hasta confirmar el email; solo se activa en registros
  // locales (email/contraseña). Google/Meta ya llegan verificados.
  @Prop({ default: false })
  requiereVerificacionEmail!: boolean;

  @Prop()
  verificacionToken?: string;

  @Prop()
  verificacionExpira?: Date;

  @Prop()
  avatarUrl?: string;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

UsuarioSchema.index({ email: 1 }, { unique: true });
