import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PerrosService, HistoriaCompartida } from './perros.service';
import { PerroValoracionesService, IndiceComportamiento } from './perro-valoraciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CrearPerroDto, ActualizarPerroDto, CrearPerroHistorialDto, CrearPerroValoracionDto, Rol } from 'shared';
import { PerroDocument } from './perro.schema';
import { PerroHistorialDocument } from './perro-historial.schema';
import { PerroValoracionDocument } from './perro-valoracion.schema';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

@ApiTags('perros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('perros')
export class PerrosController {
  constructor(
    private readonly perrosService: PerrosService,
    private readonly valoracionesService: PerroValoracionesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un perro en la Ficha Inteligente del propietario' })
  crear(@Body() dto: CrearPerroDto, @Req() req: RequestConUsuario): Promise<PerroDocument> {
    return this.perrosService.crear(req.user.sub, dto);
  }

  @Get('mis')
  @ApiOperation({ summary: 'Listar los perros del usuario autenticado' })
  misPerros(@Req() req: RequestConUsuario): Promise<PerroDocument[]> {
    return this.perrosService.listarPorPropietario(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un perro propio por id' })
  obtener(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<PerroDocument> {
    return this.perrosService.obtenerPropio(id, req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar la ficha de un perro propio' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarPerroDto,
    @Req() req: RequestConUsuario,
  ): Promise<PerroDocument> {
    return this.perrosService.actualizar(id, req.user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar la ficha de un perro propio' })
  eliminar(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<void> {
    return this.perrosService.eliminar(id, req.user.sub);
  }

  @Get(':id/historial')
  @ApiOperation({ summary: 'Historial acumulado de un perro propio (notas de profesionales)' })
  listarHistorial(
    @Param('id') id: string,
    @Req() req: RequestConUsuario,
  ): Promise<PerroHistorialDocument[]> {
    return this.perrosService.listarHistorial(id, req.user.sub);
  }

  @Post(':id/historial')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'El comercio añade una nota al historial del perro tras un servicio' })
  agregarHistorial(
    @Param('id') id: string,
    @Body() dto: CrearPerroHistorialDto,
    @Req() req: RequestConUsuario,
  ): Promise<PerroHistorialDocument> {
    return this.perrosService.agregarHistorial(id, req.user.comercioId!, dto);
  }

  @Get(':id/historia-veterinaria')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Historia Veterinaria Compartida: salud e historial del perro, con autorización del propietario' })
  obtenerHistoriaCompartida(@Param('id') id: string): Promise<HistoriaCompartida> {
    return this.perrosService.obtenerHistoriaCompartida(id);
  }

  @Get(':id/indice-comportamiento')
  @ApiOperation({ summary: 'Índice de comportamiento agregado del perro (reputación bidireccional)' })
  indiceComportamiento(@Param('id') id: string): Promise<IndiceComportamiento> {
    return this.valoracionesService.indiceComportamiento(id);
  }

  @Post(':id/valoraciones')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'El comercio valora al perro tras completar una reserva' })
  crearValoracion(
    @Param('id') id: string,
    @Body() dto: CrearPerroValoracionDto,
    @Req() req: RequestConUsuario,
  ): Promise<PerroValoracionDocument> {
    return this.valoracionesService.crear(id, req.user.comercioId!, dto);
  }

  @Get(':id/valoraciones')
  @ApiOperation({ summary: 'Historial detallado de valoraciones recibidas por el perro' })
  listarValoraciones(@Param('id') id: string): Promise<PerroValoracionDocument[]> {
    return this.valoracionesService.listarPorPerro(id);
  }
}
