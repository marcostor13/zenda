import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { UsuarioDocument } from './usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async obtenerPerfil(userId: string): Promise<UsuarioDocument> {
    const usuario = await this.repo.findById(userId);
    if (!usuario) throw new DomainException('Usuario no encontrado', 404);
    return usuario;
  }

  async actualizarPerfil(
    userId: string,
    datos: { nombre?: string; telefono?: string; avatarUrl?: string },
  ): Promise<UsuarioDocument> {
    const actualizado = await this.repo.actualizarPorId(userId, datos);
    if (!actualizado) throw new DomainException('Usuario no encontrado', 404);
    return actualizado;
  }

  async cambiarPassword(
    userId: string,
    passwordActual: string,
    nuevaPassword: string,
  ): Promise<void> {
    const usuario = await this.repo.findById(userId);
    if (!usuario) throw new DomainException('Usuario no encontrado', 404);
    // Las cuentas creadas solo con Google/Meta no tienen contraseña que cambiar.
    if (!usuario.passwordHash) {
      throw new DomainException('Tu cuenta usa acceso con Google o Meta y no tiene contraseña', 400);
    }
    const valida = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!valida) throw new DomainException('La contraseña actual es incorrecta', 400);
    const hash = await bcrypt.hash(nuevaPassword, 10);
    await this.repo.actualizarPassword(userId, hash);
  }
}
