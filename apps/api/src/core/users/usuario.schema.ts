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

  /**
   * Áreas del panel que puede tocar un administrador. Vacío = acceso total, que
   * es como se comportaban todas las cuentas antes de existir los permisos
   * (TCK-8040 §7).
   */
  @Prop({ type: [String], default: [] })
  permisosAdmin!: string[];

  /**
   * Áreas del panel del comercio que puede tocar este miembro. Vacío = acceso
   * completo, que es como funcionaba el equipo antes de existir los permisos
   * (TCK-8026/8027).
   */
  @Prop({ type: [String], default: [] })
  permisosComercio!: string[];

  /**
   * Una cuenta desactivada conserva su historial pero no puede entrar. Se
   * prefiere a borrarla: al eliminarla se perdería quién atendió cada reserva.
   */
  @Prop({ default: true })
  activo!: boolean;

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

  /**
   * Consentimiento para comunicaciones comerciales (RGPD). **Sin esto no se
   * envía nada promocional**, ni siquiera un aviso de reserva abandonada: los
   * correos transaccionales (confirmación, ajuste de precio) no dependen de él.
   */
  @Prop({ type: Boolean, default: false })
  aceptaMarketing!: boolean;

  @Prop()
  fechaConsentimientoMarketing?: Date;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

UsuarioSchema.index({ email: 1 }, { unique: true });
