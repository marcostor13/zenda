import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { ReviewsService, PendienteDeValorarDto } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { Rol } from 'shared';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { ActualizarReviewDto, CrearReviewDto } from './dto/reviews.dto';
import { ResenaDocument } from './resena.schema';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una reseña a partir de una reserva confirmada/completada' })
  crear(@Req() req: RequestConUsuario, @Body() dto: CrearReviewDto): Promise<ResenaDocument> {
    return this.reviewsService.crear(req.user.sub, dto);
  }

  @Get('pendientes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reservas confirmadas/completadas del usuario sin reseñar aún (HU-11.2)' })
  pendientes(@Req() req: RequestConUsuario): Promise<PendienteDeValorarDto[]> {
    return this.reviewsService.pendientesDeValorar(req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Listar reseñas por servicio, usuario o comercio' })
  listar(
    @Query('servicioId') servicioId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('comercioId') comercioId?: string,
  ): Promise<ResenaDocument[]> {
    if (servicioId) return this.reviewsService.listarPorServicio(servicioId);
    if (usuarioId) return this.reviewsService.listarPorUsuario(usuarioId);
    if (comercioId) return this.reviewsService.listarPorComercio(comercioId);
    throw new DomainException('Indica servicioId, usuarioId o comercioId', 400);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Todas las reseñas para administración, ocultas incluidas' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'buscar', required: false })
  @ApiQuery({ name: 'ocultas', required: false, type: Boolean })
  @ApiQuery({ name: 'puntuacion', required: false })
  listarParaAdmin(
    @Query('page') page?: string,
    @Query('limite') limite?: string,
    @Query('buscar') buscar?: string,
    @Query('ocultas') ocultas?: string,
    @Query('puntuacion') puntuacion?: string,
  ): Promise<{ items: ResenaDocument[]; total: number }> {
    return this.reviewsService.listarParaAdmin(
      {
        buscar,
        ocultas: ocultas === undefined ? undefined : ocultas === 'true',
        puntuacion: puntuacion ? Number(puntuacion) : undefined,
      },
      page ? Number(page) : 1,
      limite ? Number(limite) : 20,
    );
  }

  @Patch(':id/visibilidad')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ocultar o reponer una reseña desde administración' })
  fijarVisibilidad(
    @Param('id') id: string,
    @Body() dto: { oculta: boolean },
  ): Promise<ResenaDocument> {
    return this.reviewsService.fijarOcultaComoAdmin(id, dto.oculta);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar una reseña propia (puntuación, comentario, aspectos, fotos)' })
  actualizar(
    @Req() req: RequestConUsuario,
    @Param('id') id: string,
    @Body() dto: ActualizarReviewDto,
  ): Promise<ResenaDocument> {
    return this.reviewsService.actualizar(req.user.sub, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar (borrado lógico) una reseña propia' })
  eliminar(@Req() req: RequestConUsuario, @Param('id') id: string): Promise<void> {
    return this.reviewsService.eliminar(req.user.sub, id);
  }
}
