import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegistroDto, AuthResponseDto, RegistroPendienteDto } from 'shared';
import { UsersRepository } from '../users/users.repository';
import { UsuarioDocument } from '../users/usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { PerfilSocial, SocialAuthService } from './social-auth.service';

const VERIFICACION_VALIDEZ_MS = 24 * 60 * 60 * 1000;

export interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  comercioId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly socialAuthService: SocialAuthService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
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

    // Bloqueo por email sin verificar (solo afecta a registros locales recientes).
    if (usuario.requiereVerificacionEmail && !usuario.verificado) {
      throw new DomainException(
        'Verifica tu email antes de entrar. Te enviamos un enlace a tu correo.',
        403,
      );
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

  async registro(dto: RegistroDto): Promise<RegistroPendienteDto> {
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

    await this.iniciarVerificacionEmail(usuario);
    return { requiereVerificacion: true, email: usuario.email };
  }

  /**
   * Genera un token de verificación de un solo uso, lo guarda con caducidad y
   * envía el correo con el enlace de confirmación. Se reutiliza en el alta de
   * cliente y de comercio, y en el reenvío.
   */
  async iniciarVerificacionEmail(usuario: UsuarioDocument): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + VERIFICACION_VALIDEZ_MS);
    await this.usersRepository.establecerTokenVerificacion(usuario.id, token, expira);

    const url = `${this.urlFrontend()}/auth/verificar?token=${token}`;
    await this.notificationsService.enviarVerificacionEmail(usuario.email, usuario.nombre, url);

    // Sin email configurado el correo no llega: dejamos el enlace en el log para verificar en dev.
    const emailConfigurado = this.config.get<string>('EMAIL_USER') || this.config.get<string>('SMTP_HOST');
    if (!emailConfigurado) {
      this.logger.warn(`Verificación (sin email configurado) para ${usuario.email}: ${url}`);
    }
  }

  /** Confirma el email con el token y devuelve la sesión ya autenticada. */
  async verificarEmail(token: string): Promise<AuthResponseDto> {
    const usuario = await this.usersRepository.findByVerificacionToken(token);
    if (!usuario || !usuario.verificacionExpira || usuario.verificacionExpira.getTime() < Date.now()) {
      throw new DomainException('El enlace de verificación no es válido o ha caducado.', 400);
    }
    const confirmado = await this.usersRepository.confirmarVerificacion(usuario.id);
    return this.construirRespuesta(confirmado ?? usuario);
  }

  /** Reenvía el correo de verificación si la cuenta existe y sigue pendiente. */
  async reenviarVerificacion(email: string): Promise<void> {
    const usuario = await this.usersRepository.findByEmail(email);
    // No revelamos si el email existe: solo reenviamos cuando procede.
    if (usuario && usuario.requiereVerificacionEmail && !usuario.verificado) {
      await this.iniciarVerificacionEmail(usuario);
    }
  }

  /** Emite un token fresco para un usuario ya existente (p. ej. tras vincularlo a un comercio). */
  async emitirTokenParaUsuario(usuario: UsuarioDocument): Promise<AuthResponseDto> {
    return this.construirRespuesta(usuario);
  }

  private urlFrontend(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
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
