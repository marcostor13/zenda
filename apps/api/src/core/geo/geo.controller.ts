import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CoordenadasLugar, GeoService, SugerenciaLugar, TiposDeCambio, Trayecto } from './geo.service';

/**
 * Proxy público de mapas y divisas. Es público a propósito: el buscador lo usa
 * antes de que el visitante inicie sesión. La clave de Google se queda en el
 * servidor y las respuestas van cacheadas para acotar el coste por sesión.
 */
@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('autocomplete')
  @ApiOperation({ summary: 'Sugerir poblaciones desde la primera letra escrita' })
  @ApiQuery({ name: 'q', required: true, description: 'Texto tecleado por el usuario' })
  @ApiQuery({ name: 'session', required: false, description: 'Token de sesión de Places (agrupa la facturación)' })
  autocompletar(
    @Query('q') q?: string,
    @Query('session') session?: string,
  ): Promise<SugerenciaLugar[]> {
    return this.geoService.autocompletar(q ?? '', session);
  }

  @Get('geocode')
  @ApiOperation({ summary: 'Coordenadas de una población ya elegida' })
  @ApiQuery({ name: 'placeId', required: true })
  geocodificar(@Query('placeId') placeId?: string): Promise<CoordenadasLugar | null> {
    return this.geoService.coordenadas(placeId ?? '');
  }

  @Get('trayecto')
  @ApiOperation({ summary: 'Distancia y duración entre dos poblaciones (tarifa de transporte)' })
  @ApiQuery({ name: 'origen', required: true, description: 'placeId de recogida' })
  @ApiQuery({ name: 'destino', required: true, description: 'placeId de destino' })
  trayecto(
    @Query('origen') origen?: string,
    @Query('destino') destino?: string,
  ): Promise<Trayecto | null> {
    return this.geoService.trayecto(origen ?? '', destino ?? '');
  }

  @Get('fx')
  @ApiOperation({ summary: 'Tipos de cambio del BCE con base EUR (solo para mostrar precios)' })
  tiposDeCambio(): Promise<TiposDeCambio> {
    return this.geoService.tiposDeCambio();
  }
}
