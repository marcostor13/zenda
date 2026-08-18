import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegistroDto, AuthResponseDto, RegistroPendienteDto, Rol } from 'shared';
import { UsersRepository } from '../users/users.repository';
import { UsuarioDocument } from '../users/usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { PerfilSocial, SocialAuthService } from './social-auth.service';
import { urlPublica } from '../../shared/url-publica';

const VERIFICACION_VALIDEZ_MS = 24 * 60 * 60 * 1000;

/**
 * Mensaje único para cualquier fallo de credenciales. Distinguir "no existe" de
 * "existe pero entra con Google" convierte el login en un buscador de cuentas.
 */
const CREDENCIALES_INCORRECTAS = 'Email o contraseña incorrectos';

/**
 * Una hora. Más corto que la verificación de email (24 h) a propósito: este
 * enlace da acceso a la cuenta, no sólo la activa.
 */
const RECUPERACION_VALIDEZ_MS = 60 * 60 * 1000;

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

    /*
     * Misma respuesta exista o no la cuenta. Antes el mensaje "Esta cuenta usa
     * acceso con Google o Meta" sólo salía si el email estaba registrado, así
     * que servía de oráculo para enumerar usuarios: se probaban correos y el
     * que cambiaba de mensaje era uno de verdad.
     *
     * Quien se registró con Google pierde esa pista, sí; a cambio la pantalla de
     * login muestra los botones sociales junto al formulario, que es donde toca
     * resolverlo. Un mensaje de error no puede ser el sitio.
     */
    if (!usuario || !usuario.passwordHash) {
      throw new UnauthorizedException(CREDENCIALES_INCORRECTAS);
    }

    const passwordValida = await bcrypt.compare(dto.password, usuario.passwordHash);

    if (!passwordValida) {
      throw new UnauthorizedException(CREDENCIALES_INCORRECTAS);
    }

    // Desactivar a alguien del equipo sólo sirve si además no puede entrar.
    if (usuario.activo === false) {
      throw new DomainException('Tu cuenta está desactivada. Contacta con el administrador de tu negocio.', 403);
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
    const esComercio = usuario.rol === Rol.COMERCIO_ADMIN || usuario.rol === Rol.COMERCIO_STAFF;
    await this.notificationsService.enviarVerificacionEmail(usuario.email, usuario.nombre, url, esComercio);

    // Sin email configurado el correo no llega: dejamos el enlace en el log para verificar en dev.
    if (!this.hayEmailConfigurado()) {
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

  /**
   * Paso 1 de la recuperación: envía el enlace si la cuenta existe y tiene
   * contraseña local.
   *
   * **Siempre devuelve void sin distinguir casos.** Responder distinto según si
   * el email está registrado convertiría este endpoint en el mismo oráculo de
   * enumeración que se acaba de cerrar en el login.
   */
  async solicitarRecuperacionPassword(email: string): Promise<void> {
    const usuario = await this.usersRepository.findByEmail(email);

    // Sin `passwordHash` la cuenta es sólo social: no hay contraseña que
    // restablecer, y crear una por esta vía permitiría entrar sin pasar por el
    // proveedor que verificó ese email.
    if (!usuario || !usuario.passwordHash) return;

    const token = randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + RECUPERACION_VALIDEZ_MS);
    await this.usersRepository.establecerTokenRecuperacion(usuario.id, this.hashear(token), expira);

    const url = `${this.urlFrontend()}/auth/restablecer?token=${token}`;
    await this.notificationsService.enviarRecuperacionPassword(usuario.email, usuario.nombre, url);

    if (!this.hayEmailConfigurado()) {
      this.logger.warn(`Recuperación (sin email configurado) para ${usuario.email}: ${url}`);
    }
  }

  /**
   * Paso 2: valida el token, fija la contraseña nueva y devuelve la sesión ya
   * iniciada, para que el usuario no tenga que escribirla otra vez acto seguido.
   */
  async restablecerPassword(token: string, nuevaPassword: string): Promise<AuthResponseDto> {
    const usuario = await this.usersRepository.findByRecuperacionTokenHash(this.hashear(token));

    if (!usuario || !usuario.recuperacionExpira || usuario.recuperacionExpira.getTime() < Date.now()) {
      throw new DomainException('El enlace para restablecer la contraseña no es válido o ha caducado.', 400);
    }

    const passwordHash = await bcrypt.hash(nuevaPassword, 10);
    const actualizado = await this.usersRepository.restablecerPassword(usuario.id, passwordHash);

    // Quien demuestra tener acceso al correo ha verificado ese email de hecho:
    // dejarlo bloqueado por "email sin verificar" no protege de nada y deja al
    // usuario con la contraseña cambiada y sin poder entrar.
    if (actualizado?.requiereVerificacionEmail && !actualizado.verificado) {
      const confirmado = await this.usersRepository.confirmarVerificacion(actualizado.id);
      return this.construirRespuesta(confirmado ?? actualizado);
    }

    return this.construirRespuesta(actualizado ?? usuario);
  }

  /**
   * SHA-256 basta y sobra aquí: el token son 32 bytes aleatorios, no una
   * contraseña, así que no hay diccionario que aplicarle y no hace falta el
   * coste de bcrypt en un endpoint sin sesión.
   */
  private hashear(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hayEmailConfigurado(): boolean {
    return Boolean(this.config.get<string>('EMAIL_USER') || this.config.get<string>('SMTP_HOST'));
  }

  /** Emite un token fresco para un usuario ya existente (p. ej. tras vincularlo a un comercio). */
  async emitirTokenParaUsuario(usuario: UsuarioDocument): Promise<AuthResponseDto> {
    return this.construirRespuesta(usuario);
  }

  private urlFrontend(): string {
    return urlPublica(this.config.get<string>('APP_URL'), this.config.get<string>('NODE_ENV'));
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
        verificado: usuario.verificado,
      },
    };
  }
}
