import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  LoginDto,
  RegistroDto,
  AuthResponseDto,
  GoogleLoginDto,
  FacebookLoginDto,
  RegistroPendienteDto,
  VerificarEmailDto,
  ReenviarVerificacionDto,
  RecuperarPasswordDto,
  RestablecerPasswordDto,
} from 'shared';
import { AuthService } from './auth.service';
import { ConfigSocial, SocialAuthService } from './social-auth.service';

/**
 * Todo `auth` es público y toca credenciales, así que es la superficie que hay
 * que estrechar más: 10 intentos por minuto y por IP bastan para cualquier uso
 * humano y dejan la fuerza bruta y el alta masiva de cuentas fuera de juego.
 */
const LIMITE_CREDENCIALES = { default: { limit: 10, ttl: 60_000 } };

/** El reenvío manda correo de verdad: más estrecho todavía, para no ser un relay de spam. */
const LIMITE_ENVIO_EMAIL = { default: { limit: 3, ttl: 60_000 } };

@ApiTags('auth')
@Throttle(LIMITE_CREDENCIALES)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialAuthService: SocialAuthService,
  ) {}

  /**
   * Identificadores públicos con los que el navegador dibuja los botones
   * sociales. Los sirve el API para que no puedan divergir de los que él mismo
   * valida: cuando el botón se dibujaba con `WEB_GOOGLE_CLIENT_ID` y el API
   * comprobaba `GOOGLE_CLIENT_ID`, un valor distinto en cualquiera de los dos
   * lados tumbaba todos los accesos con un 401.
   */
  @Get('social/config')
  @ApiOperation({ summary: 'Client IDs públicos del login social (Google y Meta)' })
  configSocial(): ConfigSocial {
    return this.socialAuthService.configPublica();
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('registro')
  @ApiOperation({ summary: 'Registrar nuevo usuario (queda pendiente de verificar email)' })
  registro(@Body() dto: RegistroDto): Promise<RegistroPendienteDto> {
    return this.authService.registro(dto);
  }

  @Post('verificar-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar el email con el token recibido por correo' })
  verificarEmail(@Body() dto: VerificarEmailDto): Promise<AuthResponseDto> {
    return this.authService.verificarEmail(dto.token);
  }

  @Post('reenviar-verificacion')
  @Throttle(LIMITE_ENVIO_EMAIL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar el correo de verificación' })
  async reenviarVerificacion(@Body() dto: ReenviarVerificacionDto): Promise<{ ok: true }> {
    await this.authService.reenviarVerificacion(dto.email);
    return { ok: true };
  }

  /**
   * Responde 202 siempre, exista o no la cuenta: un 404 cuando el email no está
   * registrado convertiría esto en un buscador de usuarios, igual que pasaba con
   * el mensaje del login.
   */
  @Post('recuperar-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(LIMITE_ENVIO_EMAIL)
  @ApiOperation({ summary: 'Pedir el enlace para restablecer la contraseña' })
  async recuperarPassword(@Body() dto: RecuperarPasswordDto): Promise<void> {
    await this.authService.solicitarRecuperacionPassword(dto.email);
  }

  @Post('restablecer-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fijar la contraseña nueva con el token del correo; devuelve la sesión' })
  restablecerPassword(@Body() dto: RestablecerPasswordDto): Promise<AuthResponseDto> {
    return this.authService.restablecerPassword(dto.token, dto.nuevaPassword);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión / registrarse con Google' })
  google(@Body() dto: GoogleLoginDto): Promise<AuthResponseDto> {
    return this.authService.loginConGoogle(dto.idToken);
  }

  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión / registrarse con Meta (Facebook)' })
  facebook(@Body() dto: FacebookLoginDto): Promise<AuthResponseDto> {
    return this.authService.loginConFacebook(dto.accessToken);
  }
}
