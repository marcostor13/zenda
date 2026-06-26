import { Controller, Get, Patch, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';
import { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

class CambiarPasswordDto {
  @IsString()
  @MinLength(1)
  passwordActual!: string;

  @IsString()
  @MinLength(8)
  nuevaPassword!: string;
}

interface RequestConUser extends Request {
  user: { sub: string };
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener el perfil del usuario autenticado' })
  obtenerMe(@Req() req: RequestConUser) {
    return this.usersService.obtenerPerfil(req.user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar nombre, teléfono y avatar del usuario autenticado' })
  actualizarMe(
    @Req() req: RequestConUser,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.usersService.actualizarPerfil(req.user.sub, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  async cambiarPassword(
    @Req() req: RequestConUser,
    @Body() dto: CambiarPasswordDto,
  ): Promise<void> {
    await this.usersService.cambiarPassword(
      req.user.sub,
      dto.passwordActual,
      dto.nuevaPassword,
    );
  }
}
