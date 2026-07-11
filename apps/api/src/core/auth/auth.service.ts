import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegistroDto, AuthResponseDto } from 'shared';
import { UsersRepository } from '../users/users.repository';
import { UsuarioDocument } from '../users/usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  comercioId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const usuario = await this.usersRepository.findByEmail(dto.email);

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordValida = await bcrypt.compare(dto.password, usuario.passwordHash);

    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return this.construirRespuesta(usuario);
  }

  async registro(dto: RegistroDto): Promise<AuthResponseDto> {
    const existe = await this.usersRepository.findByEmail(dto.email);

    if (existe) {
      throw new DomainException('El email ya está registrado', 409);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const usuario = await this.usersRepository.crear({
      nombre: dto.nombre,
      email: dto.email,
      passwordHash,
      telefono: dto.telefono,
    });

    return this.construirRespuesta(usuario);
  }

  /** Emite un token fresco para un usuario ya existente (p. ej. tras vincularlo a un comercio). */
  async emitirTokenParaUsuario(usuario: UsuarioDocument): Promise<AuthResponseDto> {
    return this.construirRespuesta(usuario);
  }

  private construirRespuesta(usuario: UsuarioDocument): AuthResponseDto {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      comercioId: usuario.comercioId?.toString(),
    };

    return {
      accessToken: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        comercioId: usuario.comercioId?.toString(),
      },
    };
  }
}
