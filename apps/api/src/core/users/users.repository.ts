import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario, UsuarioDocument } from './usuario.schema';
import { Rol } from 'shared';

export interface CrearUsuarioParams {
  nombre: string;
  email: string;
  passwordHash?: string;
  telefono?: string;
  rol?: Rol;
  comercioId?: string;
  puesto?: string;
  proveedores?: string[];
  avatarUrl?: string;
  verificado?: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
  ) {}

  async findByEmail(email: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findById(id).exec();
  }

  /** Miembros del equipo de un comercio (admins y staff vinculados). */
  async listarPorComercio(comercioId: string): Promise<UsuarioDocument[]> {
    return this.usuarioModel
      .find({ comercioId })
      .select('nombre email rol puesto createdAt')
      .sort({ createdAt: 1 })
      .lean()
      .exec() as unknown as UsuarioDocument[];
  }

  async crear(params: CrearUsuarioParams): Promise<UsuarioDocument> {
    const usuario = new this.usuarioModel({
      ...params,
      email: params.email.toLowerCase(),
      rol: params.rol ?? Rol.CLIENTE,
    });
    return usuario.save();
  }

  async actualizarPorId(
    id: string,
    datos: Partial<Pick<Usuario, 'nombre' | 'telefono' | 'verificado' | 'avatarUrl'>>,
  ): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findByIdAndUpdate(id, datos, { new: true }).exec();
  }

  async actualizarPassword(id: string, passwordHash: string): Promise<void> {
    await this.usuarioModel.findByIdAndUpdate(id, { passwordHash }).exec();
  }

  /** Vincula un proveedor social a la cuenta (idempotente) y marca el email como verificado. */
  async vincularProveedor(id: string, proveedor: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(id, { $addToSet: { proveedores: proveedor }, verificado: true }, { new: true })
      .exec();
  }

  /** Guarda (o renueva) el token de verificación de email y marca la cuenta como pendiente. */
  async establecerTokenVerificacion(id: string, token: string, expira: Date): Promise<void> {
    await this.usuarioModel
      .findByIdAndUpdate(id, {
        verificacionToken: token,
        verificacionExpira: expira,
        requiereVerificacionEmail: true,
        verificado: false,
      })
      .exec();
  }

  async findByVerificacionToken(token: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findOne({ verificacionToken: token }).exec();
  }

  /** Confirma la verificación: marca verificado, libera el bloqueo y elimina el token. */
  async confirmarVerificacion(id: string): Promise<UsuarioDocument | null> {
    return this.usuarioModel
      .findByIdAndUpdate(
        id,
        {
          verificado: true,
          requiereVerificacionEmail: false,
          $unset: { verificacionToken: 1, verificacionExpira: 1 },
        },
        { new: true },
      )
      .exec();
  }

  async actualizarAdmin(
    id: string,
    datos: Partial<Pick<Usuario, 'nombre' | 'telefono' | 'verificado' | 'rol'>> & { email?: string; comercioId?: string },
  ): Promise<UsuarioDocument | null> {
    const update: Record<string, unknown> = { ...datos };
    if (datos.email) update['email'] = datos.email.toLowerCase();
    return this.usuarioModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async eliminar(id: string): Promise<void> {
    await this.usuarioModel.findByIdAndDelete(id).exec();
  }

  async contarTodos(): Promise<number> {
    return this.usuarioModel.countDocuments().exec();
  }
}
