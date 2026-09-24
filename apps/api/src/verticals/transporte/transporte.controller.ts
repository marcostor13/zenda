import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BuscarTransportesDto, BusquedaTransportesRespuesta, OrdenTransporte, SolicitudViajeDto } from 'shared';
import { TransporteCotizadorService } from './transporte-cotizador.service';

/**
 * Búsqueda con precio del flujo de Transporte. Pública: se compara antes de
 * iniciar sesión, igual que en el resto de buscadores.
 *
 * Cada búsqueda calcula una ruta con Google (cacheada por pareja de puntos),
 * así que va con el mismo techo por IP que el proxy de mapas.
 */
@ApiTags('transporte')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('transporte')
export class TransporteController {
  constructor(private readonly cotizador: TransporteCotizadorService) {}

  @Post('cotizaciones')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transportistas que pueden hacer un viaje, con su precio cerrado' })
  buscar(@Body() dto: BuscarTransportesDto): Promise<BusquedaTransportesRespuesta> {
    return this.cotizador.buscar(dto.solicitud, dto.orden ?? OrdenTransporte.RECOMENDADOS);
  }

  @Post('cotizaciones/:servicioId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Precio de un viaje con un transportista concreto (ficha)' })
  cotizarEmpresa(
    @Param('servicioId') servicioId: string,
    @Body() solicitud: SolicitudViajeDto,
  ): Promise<BusquedaTransportesRespuesta> {
    return this.cotizador.cotizarEmpresa(servicioId, solicitud);
  }
}
