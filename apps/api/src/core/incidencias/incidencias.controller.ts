import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ActualizarIncidenciaDto, CrearIncidenciaDto, EstadoIncidencia, Rol, TipoIncidencia } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { IncidenciaDocument } from './incidencia.schema';
import { IncidenciasService } from './incidencias.service';

interface RequestConUsuario extends Request {
  user: { sub: string; rol: Rol };
}

@ApiTags('incidencias')
@Controller('incidencias')
export class IncidenciasController {
  constructor(private readonly incidenciasService: IncidenciasService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Abrir una reclamación, devolución o incidencia' })
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearIncidenciaDto): Promise<IncidenciaDocument> {
    return this.incidenciasService.crear(req.user.sub, req.user.rol, dto);
  }

  @Get('mias')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Incidencias abiertas por el usuario autenticado' })
  mias(@Req() req: RequestConUsuario): Promise<IncidenciaDocument[]> {
    return this.incidenciasService.listarPropias(req.user.sub);
  }

  @Get('resumen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cuántas incidencias hay en cada estado' })
  resumen(): Promise<Record<string, number>> {
    return this.incidenciasService.contarPorEstado();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar incidencias (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoIncidencia })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoIncidencia })
  @ApiQuery({ name: 'buscar', required: false })
  listar(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('estado') estado?: EstadoIncidencia,
    @Query('tipo') tipo?: TipoIncidencia,
    @Query('buscar') buscar?: string,
  ): Promise<{ items: IncidenciaDocument[]; total: number }> {
    return this.incidenciasService.listar({ estado, tipo, buscar }, page, limite);
  }

  @Patch(':id/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar el estado de una incidencia dejando constancia' })
  actualizarEstado(
    @Req() req: RequestConUsuario,
    @Param('id') id: string,
    @Body() dto: ActualizarIncidenciaDto,
  ): Promise<IncidenciaDocument> {
    return this.incidenciasService.actualizarEstado(id, dto, req.user.sub);
  }
}
