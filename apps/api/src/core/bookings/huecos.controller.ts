import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  AgendaCitasDto, AgendaCitasRespuestaApi, HuecosDelDiaDto, HuecosDelDiaRespuestaApi,
} from 'shared';
import { BookingsService } from './bookings.service';
import { JwtOpcionalGuard } from '../auth/guards/jwt-opcional.guard';

interface RequestConUsuarioOpcional extends Request {
  user?: { sub: string };
}

/**
 * Citas libres de un servicio. Va aparte de `BookingsController` porque aquel
 * exige sesión en todas sus rutas y el asistente de reserva admite invitados:
 * sin sesión el cliente también tiene que ver qué horas quedan antes de elegir.
 */
@ApiTags('reservas')
@Controller('reservas/huecos')
export class HuecosController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('agenda')
  @UseGuards(JwtOpcionalGuard)
  @ApiOperation({
    summary: 'Días con cita libre de un servicio en un rango, para pintar el calendario',
    description:
      'Devuelve el estado de cada día (libre, completo, cerrado o pasado) y la primera cita '
      + 'libre del rango, de modo que el cliente elija entre lo que existe en vez de escribir '
      + 'una fecha y descubrir después que ese día no había nada.',
  })
  agenda(
    @Query() consulta: AgendaCitasDto,
    @Req() req: RequestConUsuarioOpcional,
  ): Promise<AgendaCitasRespuestaApi> {
    return this.bookingsService.agendaCitas({
      usuarioId: req.user?.sub,
      servicioId: consulta.servicioId,
      desde: consulta.desde,
      hasta: consulta.hasta,
      // La ficha del perro sólo se puede leer con la sesión de su dueño.
      perroId: req.user ? consulta.perroId : undefined,
      cantidad: consulta.cantidad,
      detalle: consulta.servicio ? { servicio: consulta.servicio } : undefined,
    });
  }

  @Get()
  @UseGuards(JwtOpcionalGuard)
  @ApiOperation({ summary: 'Citas libres de un servicio un día, para elegir la hora' })
  huecosDelDia(
    @Query() consulta: HuecosDelDiaDto,
    @Req() req: RequestConUsuarioOpcional,
  ): Promise<HuecosDelDiaRespuestaApi> {
    return this.bookingsService.huecosDelDia({
      usuarioId: req.user?.sub,
      servicioId: consulta.servicioId,
      fecha: consulta.fecha,
      // La ficha del perro sólo se puede leer con la sesión de su dueño.
      perroId: req.user ? consulta.perroId : undefined,
      cantidad: consulta.cantidad,
      detalle: consulta.servicio ? { servicio: consulta.servicio } : undefined,
    });
  }
}
