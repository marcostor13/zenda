import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MaxLength, MinLength,
} from 'class-validator';
import { Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { AvisoProgramadoDocument, DisparadorAviso, SegmentoAviso } from './aviso-programado.schema';
import { AvisosService, ResultadoAviso } from './avisos.service';
import { PushService } from '../notifications/push.service';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

const SEGMENTOS = ['todos', 'clientes', 'comercios'];
const DISPARADORES = ['pago_pendiente', 'membresia_por_vencer', 'reserva_proxima', 'difusion'];

class EnviarPushDto {
  @IsIn(SEGMENTOS)
  segmento!: SegmentoAviso;

  @IsString() @MinLength(3) @MaxLength(80)
  titulo!: string;

  @IsString() @MinLength(3) @MaxLength(300)
  cuerpo!: string;

  @IsOptional() @IsString()
  ruta?: string;

  /** Enviar sólo a estos usuarios. Tiene prioridad sobre el segmento. */
  @IsOptional() @IsArray() @IsString({ each: true })
  usuarioIds?: string[];
}

class AvisoProgramadoDto {
  @IsString() @MinLength(3) @MaxLength(80)
  nombre!: string;

  @IsIn(DISPARADORES)
  disparador!: DisparadorAviso;

  @IsOptional() @IsIn(SEGMENTOS)
  segmento?: SegmentoAviso;

  @IsString() @MinLength(3) @MaxLength(80)
  titulo!: string;

  @IsString() @MinLength(3) @MaxLength(300)
  cuerpo!: string;

  @IsOptional() @IsString()
  ruta?: string;

  @IsOptional() @IsString()
  hora?: string;

  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  diasSemana?: number[];

  @IsOptional() @IsInt() @Min(0) @Max(365)
  diasAntelacion?: number;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}

/**
 * Avisos push del panel de administración: envío inmediato y programación.
 *
 * Va bajo `/admin` y con `RolesGuard` porque desde aquí se escribe a todos los
 * móviles de la plataforma: es la superficie más ruidosa que existe y no puede
 * quedar detrás de una simple sesión iniciada.
 */
@ApiTags('admin-avisos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@Controller('admin/avisos')
export class AvisosController {
  constructor(
    private readonly avisosService: AvisosService,
    private readonly pushService: PushService,
  ) {}

  @Get('estado')
  @ApiOperation({ summary: '¿Está el envío push operativo y a cuántos dispositivos llega?' })
  async estado(): Promise<{ configurado: boolean; dispositivos: Record<string, number> }> {
    const [todos, clientes, comercios] = await Promise.all([
      this.pushService.contarDestinatarios({}),
      this.pushService.contarDestinatarios({ roles: ['cliente'] }),
      this.pushService.contarDestinatarios({ roles: ['comercio_admin', 'comercio_staff'] }),
    ]);

    return {
      configurado: this.pushService.estaConfigurado,
      dispositivos: { todos, clientes, comercios },
    };
  }

  @Post('enviar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar una notificación push ahora mismo' })
  enviar(@Body() dto: EnviarPushDto): Promise<ResultadoAviso> {
    return this.avisosService.enviarAhora(
      dto.segmento,
      { titulo: dto.titulo, cuerpo: dto.cuerpo, ruta: dto.ruta },
      dto.usuarioIds,
    );
  }

  @Get('programados')
  @ApiOperation({ summary: 'Avisos automáticos configurados' })
  listar(): Promise<AvisoProgramadoDocument[]> {
    return this.avisosService.listar();
  }

  @Post('programados')
  @ApiOperation({ summary: 'Programar un aviso automático' })
  crear(
    @Body() dto: AvisoProgramadoDto,
    @Req() req: RequestConUsuario,
  ): Promise<AvisoProgramadoDocument> {
    return this.avisosService.crear(dto, req.user.sub);
  }

  @Patch('programados/:id')
  @ApiOperation({ summary: 'Cambiar el texto, la hora o el estado de un aviso' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: Partial<AvisoProgramadoDto>,
    @Req() req: RequestConUsuario,
  ): Promise<AvisoProgramadoDocument> {
    return this.avisosService.actualizar(id, dto, req.user.sub);
  }

  @Delete('programados/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar un aviso programado' })
  eliminar(@Param('id') id: string): Promise<void> {
    return this.avisosService.eliminar(id);
  }

  @Post('programados/:id/ejecutar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disparar un aviso programado ahora, para probarlo' })
  ejecutar(@Param('id') id: string): Promise<ResultadoAviso> {
    return this.avisosService.ejecutarAhora(id);
  }
}
