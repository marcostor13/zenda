import { Controller, Get, Post, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { FavoritoResumenDto } from 'shared';
import { FavoritosService } from './favoritos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

@ApiTags('favoritos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favoritos')
export class FavoritosController {
  constructor(private readonly favoritosService: FavoritosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los servicios favoritos del usuario, enriquecidos' })
  listar(@Req() req: RequestConUsuario): Promise<FavoritoResumenDto[]> {
    return this.favoritosService.listar(req.user.sub);
  }

  @Get('ids')
  @ApiOperation({ summary: 'IDs de servicio favoritos (estado del corazón en las tarjetas)' })
  listarIds(@Req() req: RequestConUsuario): Promise<string[]> {
    return this.favoritosService.listarIds(req.user.sub);
  }

  @Post(':servicioId')
  @ApiOperation({ summary: 'Marcar un servicio como favorito' })
  agregar(
    @Param('servicioId') servicioId: string,
    @Req() req: RequestConUsuario,
  ): Promise<{ servicioId: string; favorito: boolean }> {
    return this.favoritosService.agregar(req.user.sub, servicioId);
  }

  @Delete(':servicioId')
  @ApiOperation({ summary: 'Quitar un servicio de favoritos' })
  eliminar(
    @Param('servicioId') servicioId: string,
    @Req() req: RequestConUsuario,
  ): Promise<{ servicioId: string; favorito: boolean }> {
    return this.favoritosService.eliminar(req.user.sub, servicioId);
  }
}
