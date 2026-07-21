import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
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
} from 'shared';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar el correo de verificación' })
  async reenviarVerificacion(@Body() dto: ReenviarVerificacionDto): Promise<{ ok: true }> {
    await this.authService.reenviarVerificacion(dto.email);
    return { ok: true };
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
