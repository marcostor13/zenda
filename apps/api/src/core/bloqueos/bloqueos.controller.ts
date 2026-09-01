import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ActualizarBloqueoDto, BloqueoDto, CitaAgendaDto, CrearBloqueoDto, Rol } from 'shared';
import { BloqueosService } from './bloqueos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

/**
 * Agenda de los servicios del comercio: lo reservado por Doogking y lo que el
 * negocio cierra por su cuenta.
 *
 * Todo va acotado al comercio de la sesión —nunca por parámetro— para que una
 * cuenta no pueda leer ni tocar la agenda de otra.
 */
@ApiTags('mi-agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
@Controller('mi-agenda')
export class BloqueosController {
  constructor(private readonly bloqueosService: BloqueosService) {}

  @Get('bloqueos')
  @ApiOperation({ summary: 'Tramos cerrados del comercio autenticado' })
  @ApiQuery({ name: 'servicioId', required: false })
  @ApiQuery({ name: 'desde', required: false, description: 'ISO; con `hasta`, acota por solapamiento' })
  @ApiQuery({ name: 'hasta', required: false })
  listarBloqueos(
    @Req() req: RequestConUsuario,
    @Query('servicioId') servicioId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ): Promise<BloqueoDto[]> {
    return this.bloqueosService.listar(req.user.comercioId!, {
      servicioId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }

  @Post('bloqueos')
  @ApiOperation({ summary: 'Cerrar un tramo de la agenda de un servicio propio' })
  crearBloqueo(@Req() req: RequestConUsuario, @Body() dto: CrearBloqueoDto): Promise<BloqueoDto> {
    return this.bloqueosService.crear(req.user.comercioId!, dto, req.user.sub);
  }

  @Patch('bloqueos/:id')
  @ApiOperation({ summary: 'Editar un tramo cerrado propio' })
  actualizarBloqueo(
    @Req() req: RequestConUsuario,
    @Param('id') id: string,
    @Body() dto: ActualizarBloqueoDto,
  ): Promise<BloqueoDto> {
    return this.bloqueosService.actualizar(req.user.comercioId!, id, dto);
  }

  @Delete('bloqueos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reabrir un tramo cerrado' })
  eliminarBloqueo(@Req() req: RequestConUsuario, @Param('id') id: string): Promise<void> {
    return this.bloqueosService.eliminar(req.user.comercioId!, id);
  }

  @Get('citas')
  @ApiOperation({ summary: 'Reservas vivas del comercio en un rango, para pintar la agenda' })
  @ApiQuery({ name: 'desde', required: true })
  @ApiQuery({ name: 'hasta', required: true })
  @ApiQuery({ name: 'servicioId', required: false })
  listarCitas(
    @Req() req: RequestConUsuario,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('servicioId') servicioId?: string,
  ): Promise<CitaAgendaDto[]> {
    return this.bloqueosService.listarCitas(req.user.comercioId!, new Date(desde), new Date(hasta), servicioId);
  }
}
