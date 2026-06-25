import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  CatalogService,
  HotelCardDto,
  HotelDetalleDto,
  PaginatedResult,
} from './catalog.service';

@ApiTags('catalog')
@Controller('catalog/servicios')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar servicios publicados (por defecto, hoteles)' })
  @ApiQuery({ name: 'vertical', required: false, example: 'hoteles' })
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
  ): Promise<PaginatedResult<HotelCardDto>> {
    return this.catalogService.buscarHoteles({
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
  obtener(@Param('id') id: string): Promise<HotelDetalleDto> {
    return this.catalogService.obtenerHotel(id);
  }

  private toNumber(value?: string): number | undefined {
    if (value == null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
}
