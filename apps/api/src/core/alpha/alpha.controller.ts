import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AlphaEstadoDto, AlphaNivelDto } from 'shared';
import { AlphaService, AlphaVentajaDto } from './alpha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

@ApiTags('alpha')
@Controller('alpha')
export class AlphaController {
  constructor(private readonly alphaService: AlphaService) {}

  @Get('niveles')
  @ApiOperation({ summary: 'Escalera de niveles Doogking Alpha (pública)' })
  niveles(): Promise<AlphaNivelDto[]> {
    return this.alphaService.listarNiveles();
  }

  @Get('ventajas')
  @ApiOperation({ summary: 'Negocios adheridos al programa Alpha (público)' })
  ventajas(): Promise<AlphaVentajaDto[]> {
    return this.alphaService.listarVentajas();
  }

  @Get('mi-estado')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nivel Alpha actual del usuario autenticado y progreso al siguiente' })
  miEstado(@Req() req: RequestConUsuario): Promise<AlphaEstadoDto> {
    return this.alphaService.obtenerEstado(req.user.sub);
  }
}
