import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoginDto, RegistroDto, AuthResponseDto, GoogleLoginDto, FacebookLoginDto } from 'shared';
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
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  registro(@Body() dto: RegistroDto): Promise<AuthResponseDto> {
    return this.authService.registro(dto);
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
