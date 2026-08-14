import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  ActualizarLugarDto, CrearLugarDto, CrearLugarReviewDto, EstadoModeracion, ModerarDto, Rol, TipoLugar,
} from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { LugarDocument } from './lugar.schema';
import { LugarReviewDocument } from './lugar-review.schema';
import { LugaresService } from './lugares.service';

interface RequestConUsuario extends Request {
  user: { sub: string; nombre?: string };
}

/**
 * Comunidad "Explora con tu mascota". La consulta es **pública** a propósito:
 * es contenido de descubrimiento que debe indexarse y atraer visitantes que aún
 * no tienen cuenta. Aportar y moderar sí exigen sesión.
 */
@ApiTags('lugares')
@Controller('lugares')
export class LugaresController {
  constructor(private readonly lugaresService: LugaresService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar lugares pet-friendly publicados' })
  @ApiQuery({ name: 'tipo', required: false, enum: Object.values(TipoLugar) })
  @ApiQuery({ name: 'ciudad', required: false })
  @ApiQuery({ name: 'provincia', required: false })
  @ApiQuery({ name: 'lat', required: false, type: Number, description: 'Ordena por cercanía' })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  @ApiQuery({ name: 'radioKm', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  buscar(
    @Query('tipo') tipo?: TipoLugar,
    @Query('ciudad') ciudad?: string,
    @Query('provincia') provincia?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radioKm') radioKm?: string,
    @Query('limit') limit?: string,
  ): Promise<LugarDocument[]> {
    return this.lugaresService.buscar({
      tipo, ciudad, provincia,
      lat: this.aNumero(lat),
      lng: this.aNumero(lng),
      radioKm: this.aNumero(radioKm),
      limit: this.aNumero(limit),
    });
  }

  @Get('moderacion/pendientes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Contenido de la comunidad por estado de moderación' })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoModeracion })
  pendientes(
    @Query('estado') estado?: EstadoModeracion,
  ): Promise<{ lugares: LugarDocument[]; reviews: LugarReviewDocument[] }> {
    return this.lugaresService.listarPendientes(estado);
  }

  @Get('moderacion/resumen')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Cuántas aportaciones hay en cada estado de moderación' })
  resumenModeracion(): Promise<Record<string, number>> {
    return this.lugaresService.contarPorEstado();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha de un lugar publicado' })
  obtener(@Param('id') id: string): Promise<LugarDocument> {
    return this.lugaresService.obtener(id);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Aportaciones publicadas de un lugar' })
  reviews(@Param('id') id: string): Promise<LugarReviewDocument[]> {
    return this.lugaresService.listarReviews(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Proponer un lugar nuevo (queda pendiente de moderación)' })
  crear(@Body() dto: CrearLugarDto, @Req() req: RequestConUsuario): Promise<LugarDocument> {
    return this.lugaresService.crear(dto, req.user.sub);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Proponer una corrección (vuelve a moderación)' })
  proponerCambios(
    @Param('id') id: string,
    @Body() dto: ActualizarLugarDto,
  ): Promise<LugarDocument> {
    return this.lugaresService.proponerCambios(id, dto);
  }

  @Post(':id/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aportar valoración, consejo o incidencia sobre un lugar' })
  crearReview(
    @Param('id') id: string,
    @Body() dto: CrearLugarReviewDto,
    @Req() req: RequestConUsuario,
  ): Promise<LugarReviewDocument> {
    return this.lugaresService.crearReview(id, req.user.sub, req.user.nombre ?? 'Usuario', dto);
  }

  @Patch(':id/moderar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Aprobar o rechazar un lugar' })
  moderarLugar(@Param('id') id: string, @Body() dto: ModerarDto): Promise<LugarDocument> {
    return this.lugaresService.moderarLugar(id, dto);
  }

  @Patch('reviews/:reviewId/moderar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Aprobar o rechazar una aportación de la comunidad' })
  moderarReview(
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerarDto,
  ): Promise<LugarReviewDocument> {
    return this.lugaresService.moderarReview(reviewId, dto);
  }

  private aNumero(valor?: string): number | undefined {
    if (valor === undefined || valor === '') return undefined;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
  }
}
