import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ConfigMapas, CoordenadasLugar, DireccionLugar, GeoService, SugerenciaLugar, TipoLugar,
  TiposDeCambio, Trayecto,
} from './geo.service';

/** Un `tipo` desconocido cae a poblaciones, que es el uso mayoritario. */
function esTipoLugar(valor?: string): valor is TipoLugar {
  return valor === 'ciudad' || valor === 'direccion';
}

/**
 * Proxy público de mapas y divisas. Es público a propósito: el buscador lo usa
 * antes de que el visitante inicie sesión. La clave de Google se queda en el
 * servidor y las respuestas van cacheadas para acotar el coste por sesión.
 *
 * Places y Routes se facturan por llamada contra nuestra cuenta, así que la
 * caché no basta: sin límite, un tercero puede generar la factura que quiera
 * pidiendo términos nuevos. 60 por minuto y por IP dan margen al autocompletado
 * que dispara letra a letra y siguen siendo un techo.
 */
@ApiTags('geo')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Clave de navegador para pintar el mapa con Google Maps',
    description:
      'Devuelve cadena vacía si no está configurada, y entonces el frontend pinta el mapa con '
      + 'OpenStreetMap. La clave de servidor (Places/Routes) nunca sale por aquí.',
  })
  config(): ConfigMapas {
    return this.geoService.configMapas();
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Sugerir poblaciones o direcciones desde la primera letra escrita' })
  @ApiQuery({ name: 'q', required: true, description: 'Texto tecleado por el usuario' })
  @ApiQuery({ name: 'session', required: false, description: 'Token de sesión de Places (agrupa la facturación)' })
  @ApiQuery({ name: 'tipo', required: false, enum: ['ciudad', 'direccion'] })
  autocompletar(
    @Query('q') q?: string,
    @Query('session') session?: string,
    @Query('tipo') tipo?: string,
  ): Promise<SugerenciaLugar[]> {
    return this.geoService.autocompletar(q ?? '', session, esTipoLugar(tipo) ? tipo : 'ciudad');
  }

  @Get('geocode')
  @ApiOperation({ summary: 'Coordenadas de una población ya elegida' })
  @ApiQuery({ name: 'placeId', required: true })
  geocodificar(@Query('placeId') placeId?: string): Promise<CoordenadasLugar | null> {
    return this.geoService.coordenadas(placeId ?? '');
  }

  @Get('direccion')
  @ApiOperation({ summary: 'Dirección postal completa y coordenadas de un portal elegido' })
  @ApiQuery({ name: 'placeId', required: true })
  direccion(@Query('placeId') placeId?: string): Promise<DireccionLugar | null> {
    return this.geoService.direccion(placeId ?? '');
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
