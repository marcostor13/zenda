import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsultaAsistenteDto, RespuestaAsistenteApi } from 'shared';
import { AsistenteService } from './asistente.service';

/**
 * Asistente de la web.
 *
 * Público a propósito: la mayor parte de las dudas —cómo reservar, qué pasa si
 * cancelo, cuánto cobráis— las tiene quien todavía no se ha registrado, y
 * exigir sesión para contestarlas dejaría el asistente sin su público.
 *
 * Como cada consulta consume tokens facturados a la plataforma, el límite es el
 * techo del gasto: diez preguntas por minuto y por IP dan para una conversación
 * seguida y cierran la puerta a que un tercero nos facture.
 */
@ApiTags('asistente')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('asistente')
export class AsistenteController {
  constructor(private readonly asistente: AsistenteService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Responde una duda sobre Doogking y sus procedimientos' })
  responder(@Body() consulta: ConsultaAsistenteDto): Promise<RespuestaAsistenteApi> {
    return this.asistente.responder(consulta);
  }
}
