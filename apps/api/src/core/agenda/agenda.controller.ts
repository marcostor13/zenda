import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, MinLength,
} from 'class-validator';
import { Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { AgendaDocument, BloqueoDocument, RecursoDocument } from './agenda.schema';
import { AgendaService, HuecoDisponible } from './agenda.service';
import { ProveedorCalendario } from './calendar-connector.interface';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

class FranjaDto {
  @IsNumber() @Min(0)
  diaSemana!: number;

  @IsString()
  desde!: string;

  @IsString()
  hasta!: string;
}

class GuardarAgendaDto {
  @IsString() @MinLength(2)
  nombre!: string;

  @IsOptional() @IsString()
  trabajadorId?: string;

  @IsOptional() @IsArray()
  franjas?: FranjaDto[];

  @IsOptional() @IsNumber() @Min(0)
  margenMinutos?: number;

  @IsOptional() @IsString()
  zonaHoraria?: string;

  @IsOptional() @IsBoolean()
  activa?: boolean;
}

class GuardarRecursoDto {
  @IsString() @MinLength(2)
  nombre!: string;

  @IsOptional() @IsIn(['habitacion', 'vehiculo', 'mesa', 'sala', 'otro'])
  tipo?: string;

  @IsOptional() @IsNumber() @Min(1)
  unidades?: number;
}

class BloquearDto {
  @IsDateString()
  inicio!: string;

  @IsDateString()
  fin!: string;

  @IsOptional() @IsString()
  motivo?: string;
}

@ApiTags('agenda')
@Controller('agenda')
export class AgendaController {
  constructor(
    private readonly agendaService: AgendaService,
    private readonly config: ConfigService,
  ) {}

  // ── Agendas ──

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Agendas del comercio' })
  listar(@Req() req: RequestConUsuario): Promise<AgendaDocument[]> {
    return this.agendaService.listarAgendas(req.user.comercioId!);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiOperation({ summary: 'Crear una agenda de trabajador' })
  crear(@Body() dto: GuardarAgendaDto, @Req() req: RequestConUsuario): Promise<AgendaDocument> {
    return this.agendaService.crearAgenda(req.user.comercioId!, dto as never);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiOperation({ summary: 'Actualizar jornada, márgenes o zona horaria' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: GuardarAgendaDto,
    @Req() req: RequestConUsuario,
  ): Promise<AgendaDocument> {
    return this.agendaService.actualizarAgenda(id, req.user.comercioId!, dto as never);
  }

  @Get(':id/huecos')
  @ApiOperation({ summary: 'Huecos libres de una agenda para un día y una duración' })
  @ApiQuery({ name: 'dia', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'duracionMin', required: false, type: Number })
  huecos(
    @Param('id') id: string,
    @Query('dia') dia: string,
    @Query('duracionMin') duracionMin?: string,
  ): Promise<HuecoDisponible[]> {
    return this.agendaService.huecosDe(id, new Date(dia), Number(duracionMin) || 30);
  }

  // ── Recursos ──

  @Get('recursos/mis')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Recursos reservables del comercio' })
  recursos(@Req() req: RequestConUsuario): Promise<RecursoDocument[]> {
    return this.agendaService.listarRecursos(req.user.comercioId!);
  }

  @Post('recursos')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiOperation({ summary: 'Dar de alta un recurso (habitación, vehículo, mesa…)' })
  crearRecurso(
    @Body() dto: GuardarRecursoDto,
    @Req() req: RequestConUsuario,
  ): Promise<RecursoDocument> {
    return this.agendaService.crearRecurso(req.user.comercioId!, dto as never);
  }

  // ── Bloqueos ──

  @Post(':id/bloqueos')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Bloquear una franja manualmente' })
  bloquear(
    @Param('id') id: string,
    @Body() dto: BloquearDto,
    @Req() req: RequestConUsuario,
  ): Promise<BloqueoDocument> {
    return this.agendaService.bloquear(
      id, req.user.comercioId!, new Date(dto.inicio), new Date(dto.fin), dto.motivo,
    );
  }

  @Delete('bloqueos/:bloqueoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Quitar un bloqueo manual' })
  desbloquear(
    @Param('bloqueoId') bloqueoId: string,
    @Req() req: RequestConUsuario,
  ): Promise<void> {
    return this.agendaService.desbloquear(bloqueoId, req.user.comercioId!);
  }

  // ── Sincronización externa ──

  @Get(':id/conectar/:proveedor')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiOperation({ summary: 'URL de autorización del proveedor de calendario' })
  urlConexion(
    @Param('id') id: string,
    @Param('proveedor') proveedor: ProveedorCalendario,
    @Req() req: RequestConUsuario,
  ): { url: string } {
    // El `state` lleva agenda y comercio para saber a quién pertenece la vuelta.
    const estado = Buffer
      .from(JSON.stringify({ agendaId: id, comercioId: req.user.comercioId }))
      .toString('base64url');

    return { url: this.agendaService.conector(proveedor).urlAutorizacion(estado) };
  }

  /**
   * Vuelta de OAuth. La invoca el proveedor, no el frontend, así que **no puede
   * exigir el token de sesión**: la autoría viaja firmada en el `state`.
   */
  @Get('oauth/:proveedor')
  @ApiOperation({ summary: 'Callback de OAuth del proveedor de calendario' })
  async callback(
    @Param('proveedor') proveedor: ProveedorCalendario,
    @Query('code') codigo: string,
    @Query('state') estado: string,
    @Res() res: Response,
  ): Promise<void> {
    const destino = `${this.config.get<string>('APP_URL') ?? ''}/comercio/agenda`;

    try {
      const { agendaId, comercioId } = JSON.parse(
        Buffer.from(estado, 'base64url').toString('utf8'),
      ) as { agendaId: string; comercioId: string };

      const conector = this.agendaService.conector(proveedor);
      const tokens = await conector.canjearCodigo(codigo);
      await this.agendaService.conectarCalendario(agendaId, comercioId, proveedor, tokens);

      res.redirect(`${destino}?conectado=${proveedor}`);
    } catch {
      res.redirect(`${destino}?error=conexion`);
    }
  }

  @Post(':id/sincronizar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Traer los eventos del calendario externo como bloqueos' })
  sincronizar(@Param('id') id: string): Promise<{ importados: number; eliminados: number }> {
    return this.agendaService.sincronizar(id);
  }

  @Delete(':id/conexion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiOperation({ summary: 'Desconectar el calendario externo' })
  desconectar(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<void> {
    return this.agendaService.desconectarCalendario(id, req.user.comercioId!);
  }
}
