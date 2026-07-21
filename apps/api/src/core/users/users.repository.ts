import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario, UsuarioDocument } from './usuario.schema';
import { Rol } from 'shared';

export interface CrearUsuarioParams {
  nombre: string;
  email: string;
  passwordHash: string;
  telefono?: string;
  rol?: Rol;
  comercioId?: string;
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
