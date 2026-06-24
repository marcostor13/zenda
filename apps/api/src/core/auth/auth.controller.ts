import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoginDto, RegistroDto, AuthResponseDto } from 'shared';
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
}
