import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsIn, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DispositivoDocument, PlataformaDispositivo } from './dispositivo.schema';
import { PushService } from './push.service';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

class RegistrarDispositivoDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsIn(['android', 'ios', 'web'])
  plataforma!: PlataformaDispositivo;
}

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('dispositivos')
  @ApiOperation({ summary: 'Registrar el dispositivo del usuario para notificaciones push' })
  registrar(
    @Body() dto: RegistrarDispositivoDto,
    @Req() req: RequestConUsuario,
  ): Promise<DispositivoDocument> {
    return this.pushService.registrar(req.user.sub, dto.token, dto.plataforma);
  }

  @Delete('dispositivos/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dar de baja un dispositivo (cierre de sesión, desinstalación)' })
  darDeBaja(@Param('token') token: string): Promise<void> {
    return this.pushService.darDeBaja(token);
  }
}
