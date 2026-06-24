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
    datos: Partial<Pick<Usuario, 'nombre' | 'telefono' | 'verificado'>>,
  ): Promise<UsuarioDocument | null> {
    return this.usuarioModel.findByIdAndUpdate(id, datos, { new: true }).exec();
  }
}
