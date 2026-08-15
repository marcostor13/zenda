import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermisoAdmin, Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { PermisosAdminGuard, PermisosAdmin } from '../auth/guards/permisos.guard';
import { LiquidacionDocument } from './liquidacion.schema';
import { LiquidacionesService } from './liquidaciones.service';

interface RequestConAdmin extends Request {
  user: { sub: string; rol: Rol };
}

@ApiTags('liquidaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermisosAdminGuard)
@Roles(Rol.ADMIN)
@PermisosAdmin(PermisoAdmin.FINANZAS)
@Controller('liquidaciones')
export class LiquidacionesController {
  constructor(private readonly liquidacionesService: LiquidacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Historial de liquidaciones a comercios' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'comercioId', required: false })
  @ApiQuery({ name: 'estado', required: false, enum: ['pendiente', 'pagada'] })
  listar(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('comercioId') comercioId?: string,
    @Query('estado') estado?: string,
  ): Promise<{ items: LiquidacionDocument[]; total: number }> {
    return this.liquidacionesService.listar({ comercioId, estado }, page, limite);
  }

  @Post()
  @ApiOperation({ summary: 'Generar la liquidación de un comercio para un periodo' })
  generar(
    @Body() dto: { comercioId: string; desde: string; hasta: string },
    @Req() req: RequestConAdmin,
  ): Promise<LiquidacionDocument> {
    return this.liquidacionesService.generar(
      dto.comercioId,
      new Date(dto.desde),
      new Date(dto.hasta),
      req.user.sub,
    );
  }

  @Patch(':id/pagada')
  @ApiOperation({ summary: 'Marcar una liquidación como pagada' })
  marcarPagada(
    @Param('id') id: string,
    @Body() dto: { referencia: string },
    @Req() req: RequestConAdmin,
  ): Promise<LiquidacionDocument> {
    return this.liquidacionesService.marcarPagada(id, dto.referencia, req.user.sub);
  }
}
