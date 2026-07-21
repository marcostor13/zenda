import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegistroDto, AuthResponseDto } from 'shared';
import { UsersRepository } from '../users/users.repository';
import { UsuarioDocument } from '../users/usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PerfilSocial, SocialAuthService } from './social-auth.service';

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
    private readonly socialAuthService: SocialAuthService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const usuario = await this.usersRepository.findByEmail(dto.email);

    if (!usuario) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Cuenta creada solo con Google/Meta: no tiene contraseña local que comparar.
    if (!usuario.passwordHash) {
      throw new UnauthorizedException('Esta cuenta usa acceso con Google o Meta. Entra con ese botón.');
    }

    const passwordValida = await bcrypt.compare(dto.password, usuario.passwordHash);

    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return this.construirRespuesta(usuario);
  }

  /** Login/registro con Google: verifica el ID token y resuelve la cuenta por email. */
  async loginConGoogle(idToken: string): Promise<AuthResponseDto> {
    const perfil = await this.socialAuthService.verificarGoogle(idToken);
    return this.resolverCuentaSocial(perfil, 'google');
  }

  /** Login/registro con Meta (Facebook): verifica el access token y resuelve la cuenta por email. */
  async loginConFacebook(accessToken: string): Promise<AuthResponseDto> {
    const perfil = await this.socialAuthService.verificarFacebook(accessToken);
    return this.resolverCuentaSocial(perfil, 'facebook');
  }

  /**
   * Find-or-create por email verificado por el proveedor: si la cuenta ya existe
   * se le vincula el proveedor; si no, se crea una cuenta cliente sin contraseña.
   */
  private async resolverCuentaSocial(perfil: PerfilSocial, proveedor: string): Promise<AuthResponseDto> {
    const existente = await this.usersRepository.findByEmail(perfil.email);
    if (existente) {
      const actualizado = await this.usersRepository.vincularProveedor(existente.id, proveedor);
      return this.construirRespuesta(actualizado ?? existente);
    }

    const usuario = await this.usersRepository.crear({
      nombre: perfil.nombre,
      email: perfil.email,
      avatarUrl: perfil.avatarUrl,
      proveedores: [proveedor],
      verificado: true,
    });
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
      proveedores: ['local'],
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
