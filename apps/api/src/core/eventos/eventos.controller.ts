import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

/** GIF transparente de 1×1, el más pequeño posible (43 bytes). */
const PIXEL_TRANSPARENTE = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);
import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { PasoEmbudo, Rol, TipoEvento } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { EventosService, MetricaEmbudo } from './eventos.service';
import { GrowthService, ResumenTanda, SeguimientoValoraciones } from './growth.service';

interface RequestConUsuario extends Request {
  user?: { sub: string };
}

class RegistrarEventoDto {
  @IsEnum(TipoEvento)
  tipo!: TipoEvento;

  @IsOptional()
  @IsString()
  sesionId?: string;

  @IsOptional()
  @IsString()
  reservaId?: string;

  @IsOptional()
  @IsString()
  servicioId?: string;

  @IsOptional()
  @IsString()
  vertical?: string;

  @IsOptional()
  @IsEnum(PasoEmbudo)
  paso?: PasoEmbudo;

  @IsOptional()
  @IsNumber()
  msDesdeInicio?: number;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

@ApiTags('eventos')
@Controller('eventos')
export class EventosController {
  constructor(
    private readonly eventosService: EventosService,
    private readonly growthService: GrowthService,
  ) {}

  /**
   * Registro de eventos del embudo. **Público a propósito**: la mitad del
   * embudo ocurre antes de iniciar sesión, y exigir token dejaría fuera
   * justamente los abandonos más tempranos.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Registrar un evento del embudo (medición y abandonos)' })
  async registrar(@Body() dto: RegistrarEventoDto, @Req() req: RequestConUsuario): Promise<void> {
    await this.eventosService.registrar({ ...dto, usuarioId: req.user?.sub });
  }

  @Get('valoracion/:token')
  @ApiOperation({ summary: 'Abrir el enlace único de valoración recibido por correo' })
  abrirValoracion(@Param('token') token: string): Promise<{ reservaId: string; codigo: string }> {
    return this.growthService.abrirPorToken(token);
  }

  /**
   * Píxel de apertura del correo. Devuelve un GIF transparente de 1×1 **pase lo
   * que pase**: si fallara, el cliente vería una imagen rota en su bandeja.
   */
  @Get('valoracion/:token/pixel.gif')
  @ApiOperation({ summary: 'Píxel transparente que registra la apertura del correo' })
  async pixelApertura(@Param('token') token: string, @Res() res: Response): Promise<void> {
    await this.growthService.registrarApertura(token);

    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL_TRANSPARENTE.length),
      // Sin caché: si el proxy lo guardara, solo contaríamos la primera apertura.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    });
    res.end(PIXEL_TRANSPARENTE);
  }

  // ── Panel de administración ──

  @Get('metricas/embudo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Cuántas reservas se completan en menos de 30 s (meta T4)' })
  @ApiQuery({ name: 'dias', required: false, type: Number })
  metricaEmbudo(@Query('dias') dias?: string): Promise<MetricaEmbudo> {
    return this.eventosService.metricaEmbudo(Number(dias) || undefined);
  }

  @Get('valoraciones/seguimiento')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Seguimiento de la campaña de solicitudes de reseña' })
  seguimiento(): Promise<SeguimientoValoraciones> {
    return this.growthService.seguimiento();
  }

  /**
   * Tandas disparadas desde fuera (cron de la plataforma). No son un temporizador
   * en proceso a propósito: con varias instancias del API, un `setInterval`
   * enviaría el mismo correo una vez por instancia.
   */
  @Post('tandas/valoraciones')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Enviar las solicitudes de reseña pendientes' })
  tandaValoraciones(): Promise<ResumenTanda> {
    return this.growthService.solicitarValoracionesPendientes();
  }

  @Post('tandas/recordatorios')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Enviar el recordatorio único de valoración (3 días)' })
  tandaRecordatorios(): Promise<ResumenTanda> {
    return this.growthService.enviarRecordatorios();
  }

  @Post('tandas/abandonos')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Avisar a quien dejó una reserva a medias (con consentimiento)' })
  tandaAbandonos(): Promise<ResumenTanda> {
    return this.growthService.recuperarAbandonos();
  }
}
