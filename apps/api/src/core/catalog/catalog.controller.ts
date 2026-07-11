import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import {
  CatalogService,
  ServicioCardDto,
  ServicioDetalleDto,
  PaginatedResult,
  ServicioGestionDto,
} from './catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CrearServicioDto, ActualizarServicioDto, Rol } from 'shared';

interface RequestConUser extends Request {
  user: { sub: string; comercioId?: string };
}

@ApiTags('catalog')
@Controller('catalog/servicios')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un nuevo servicio (comercio_admin)' })
  crear(
    @Body() dto: CrearServicioDto,
    @Req() req: RequestConUser,
  ): Promise<ServicioCardDto> {
    return this.catalogService.crearServicio(dto, req.user.comercioId!);
  }

  @Get()
  @ApiOperation({ summary: 'Buscar servicios publicados (por defecto, alojamiento canino)' })
  @ApiQuery({ name: 'vertical', required: false, example: 'alojamiento' })
  @ApiQuery({ name: 'ciudad', required: false })
  @ApiQuery({ name: 'precioMin', required: false, type: Number })
  @ApiQuery({ name: 'precioMax', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  buscar(
    @Query('vertical') vertical?: string,
    @Query('ciudad') ciudad?: string,
    @Query('precioMin') precioMin?: string,
    @Query('precioMax') precioMax?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PaginatedResult<ServicioCardDto>> {
    return this.catalogService.buscarServicios({
      vertical,
      ciudad,
      precioMin: this.toNumber(precioMin),
      precioMax: this.toNumber(precioMax),
      page: this.toNumber(page),
      limit: this.toNumber(limit),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el detalle de un servicio por id' })
  obtener(@Param('id') id: string): Promise<ServicioDetalleDto> {
    return this.catalogService.obtenerServicio(id);
  }

  @Get(':id/gestion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener un servicio propio con todos sus campos, para editarlo (comercio_admin)' })
  obtenerParaGestion(
    @Param('id') id: string,
    @Req() req: RequestConUser,
  ): Promise<ServicioGestionDto> {
    return this.catalogService.obtenerServicioParaGestion(id, req.user.comercioId!);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar un servicio propio (comercio_admin)' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarServicioDto,
    @Req() req: RequestConUser,
  ): Promise<ServicioCardDto> {
    return this.catalogService.actualizarServicio(id, req.user.comercioId!, dto);
  }

  private toNumber(value?: string): number | undefined {
    if (value == null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
}
