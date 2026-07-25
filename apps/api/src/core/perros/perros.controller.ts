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
import {
  CrearPerroDto, ActualizarPerroDto, CrearPerroHistorialDto, CrearPerroValoracionDto,
  EditarHistorialDto, FijarConsentimientoDto, ImportarHistorialDto, PrevisualizarImportacionDto,
  Rol,
} from 'shared';
import { PerroDocument } from './perro.schema';
import { PerroHistorialDocument } from './perro-historial.schema';
import { PerroValoracionDocument } from './perro-valoracion.schema';
import { PerroVersionDocument } from './perro-version.schema';
import { ConsentimientoDocument } from './consentimiento.schema';

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

  @Patch(':id/historial/:historialId')
  @ApiOperation({ summary: 'El propietario corrige una entrada del historial de su mascota' })
  editarHistorial(
    @Param('id') id: string,
    @Param('historialId') historialId: string,
    @Body() dto: EditarHistorialDto,
    @Req() req: RequestConUsuario,
  ): Promise<PerroHistorialDocument> {
    return this.perrosService.editarHistorial(id, historialId, req.user.sub, dto.nota);
  }

  @Delete(':id/historial/:historialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'El propietario elimina una entrada del historial de su mascota' })
  eliminarHistorial(
    @Param('id') id: string,
    @Param('historialId') historialId: string,
    @Req() req: RequestConUsuario,
  ): Promise<void> {
    return this.perrosService.eliminarHistorial(id, historialId, req.user.sub);
  }

  @Post(':id/historial/previsualizar')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Convierte el texto pegado (Excel o documento) en filas, sin guardar nada' })
  previsualizarImportacion(
    @Body() dto: PrevisualizarImportacionDto,
  ): Array<{ fecha?: string; concepto: string; detalle?: string }> {
    return this.perrosService.parsearImportacion(dto.texto);
  }

  @Post(':id/historial/importar')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Guarda las filas del historial ya revisadas por el profesional' })
  async importarHistorial(
    @Param('id') id: string,
    @Body() dto: ImportarHistorialDto,
    @Req() req: RequestConUsuario,
  ): Promise<{ importadas: number }> {
    const importadas = await this.perrosService.importarHistorial(
      id, req.user.comercioId!, dto.vertical, dto.filas,
    );
    return { importadas };
  }

  @Get(':id/versiones')
  @ApiOperation({ summary: 'Historial de cambios de la ficha del perro' })
  listarVersiones(
    @Param('id') id: string,
    @Req() req: RequestConUsuario,
  ): Promise<PerroVersionDocument[]> {
    return this.perrosService.listarVersiones(id, req.user.sub);
  }

  @Get(':id/consentimientos')
  @ApiOperation({ summary: 'Qué tipo de historial ve cada categoría de servicio' })
  listarConsentimientos(
    @Param('id') id: string,
    @Req() req: RequestConUsuario,
  ): Promise<ConsentimientoDocument[]> {
    return this.perrosService.listarConsentimientos(id, req.user.sub);
  }

  @Patch(':id/consentimientos')
  @ApiOperation({ summary: 'Conceder o revocar el acceso de una categoría a un historial' })
  fijarConsentimiento(
    @Param('id') id: string,
    @Body() dto: FijarConsentimientoDto,
    @Req() req: RequestConUsuario,
  ): Promise<ConsentimientoDocument> {
    return this.perrosService.fijarConsentimiento(id, req.user.sub, dto);
  }

  @Delete(':id/consentimientos')
  @ApiOperation({ summary: 'Revocar de golpe todos los permisos de compartición' })
  async revocarConsentimientos(
    @Param('id') id: string,
    @Req() req: RequestConUsuario,
  ): Promise<{ revocados: number }> {
    const revocados = await this.perrosService.revocarTodosLosConsentimientos(id, req.user.sub);
    return { revocados };
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
