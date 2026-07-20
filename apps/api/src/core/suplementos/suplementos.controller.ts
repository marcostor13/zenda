import { Controller, Post, Get, Patch, Delete, Param, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { SuplementosService } from './suplementos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CrearSuplementoConfigDto, ActualizarSuplementoConfigDto, Rol } from 'shared';
import { SuplementoConfigDocument } from './suplemento-config.schema';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

@ApiTags('suplementos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
@Controller('suplementos')
export class SuplementosController {
  constructor(private readonly suplementosService: SuplementosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un suplemento preconfigurado para el comercio autenticado' })
  crear(
    @Body() dto: CrearSuplementoConfigDto,
    @Req() req: RequestConUsuario,
  ): Promise<SuplementoConfigDocument> {
    return this.suplementosService.crear(req.user.comercioId!, dto);
  }

  @Get('mis')
  @ApiOperation({ summary: 'Listar los suplementos preconfigurados del comercio autenticado' })
  misSuplementos(@Req() req: RequestConUsuario): Promise<SuplementoConfigDocument[]> {
    return this.suplementosService.listarPorComercio(req.user.comercioId!);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un suplemento propio' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarSuplementoConfigDto,
    @Req() req: RequestConUsuario,
  ): Promise<SuplementoConfigDocument> {
    return this.suplementosService.actualizar(id, req.user.comercioId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un suplemento propio' })
  eliminar(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<void> {
    return this.suplementosService.eliminar(id, req.user.comercioId!);
  }
}
