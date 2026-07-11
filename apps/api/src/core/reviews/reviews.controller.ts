import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { CrearReviewDto } from './dto/reviews.dto';
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
}
