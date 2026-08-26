import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CrearReservaDto, ComprobarDisponibilidadDto, DisponibilidadRespuesta,
  CalendarioDisponibilidadDto,
} from 'shared';
import { CalendarioDisponibilidadRespuesta } from './bookings.service';
import { ReservaDocument } from './reserva.schema';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

@ApiTags('reservas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservas')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una reserva (genera un SlotHold temporal)' })
  crear(@Body() dto: CrearReservaDto, @Req() req: RequestConUsuario): Promise<ReservaDocument> {
    return this.bookingsService.crear({
      usuarioId: req.user.sub,
      comercioId: dto.comercioId,
      servicioId: dto.servicioId,
      vertical: dto.vertical,
      perroId: dto.perroId,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      cantidad: dto.cantidad,
      detalle: dto.detalle,
      cuponCodigo: dto.cuponCodigo,
      recurrencia: dto.recurrencia
        ? { diasSemana: dto.recurrencia.diasSemana, hora: dto.recurrencia.hora, fechaFin: new Date(dto.recurrencia.fechaFin) }
        : undefined,
    });
  }

  @Post('disponibilidad')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '¿Se puede reservar este servicio con estos datos? No crea nada ni bloquea cupo',
  })
  comprobarDisponibilidad(
    @Body() dto: ComprobarDisponibilidadDto,
    @Req() req: RequestConUsuario,
  ): Promise<DisponibilidadRespuesta> {
    return this.bookingsService.comprobarDisponibilidad({
      usuarioId: req.user.sub,
      comercioId: dto.comercioId,
      servicioId: dto.servicioId,
      vertical: dto.vertical,
      perroId: dto.perroId,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      cantidad: dto.cantidad,
      detalle: dto.detalle,
    });
  }

  @Get('disponibilidad/calendario')
  @ApiOperation({
    summary: 'Días reservables de un servicio en un rango, para pintar el calendario',
  })
  calendarioDisponibilidad(
    @Query() consulta: CalendarioDisponibilidadDto,
    @Req() req: RequestConUsuario,
  ): Promise<CalendarioDisponibilidadRespuesta> {
    return this.bookingsService.calendarioDisponibilidad({
      usuarioId: req.user.sub,
      servicioId: consulta.servicioId,
      desde: new Date(consulta.desde),
      hasta: new Date(consulta.hasta),
      espacioId: consulta.espacioId,
    });
  }

  @Get('mis')
  @ApiOperation({ summary: 'Listar las reservas del usuario autenticado' })
  misReservas(@Req() req: RequestConUsuario): Promise<ReservaDocument[]> {
    return this.bookingsService.listarPorUsuario(req.user.sub);
  }

  @Get('recordatorios')
  @ApiOperation({ summary: 'Recordatorios de cuidado según el historial del usuario' })
  recordatorios(@Req() req: RequestConUsuario) {
    return this.bookingsService.recordatorios(req.user.sub);
  }

  @Get('puntos')
  @ApiOperation({ summary: 'Puntos Doogking del usuario y progreso al próximo descuento' })
  puntos(@Req() req: RequestConUsuario) {
    return this.bookingsService.obtenerPuntos(req.user.sub);
  }

  @Get('proxima')
  @ApiOperation({ summary: 'Próxima reserva confirmada del usuario, o null si no tiene ninguna' })
  proxima(@Req() req: RequestConUsuario) {
    return this.bookingsService.proxima(req.user.sub);
  }

  @Get('viaje/:reservaMadreId')
  @ApiOperation({ summary: 'Todas las reservas de un viaje: la principal y las vinculadas' })
  viaje(
    @Param('reservaMadreId') reservaMadreId: string,
    @Req() req: RequestConUsuario,
  ): Promise<ReservaDocument[]> {
    return this.bookingsService.listarViaje(reservaMadreId, req.user.sub);
  }

  @Get('codigo/:codigo')
  @ApiOperation({ summary: 'Obtener una reserva propia por código (ej: RES-XXXXXXXX)' })
  obtenerPorCodigo(
    @Param('codigo') codigo: string,
    @Req() req: RequestConUsuario,
  ): Promise<ReservaDocument> {
    return this.bookingsService.obtenerPorCodigo(codigo, req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una reserva propia por id' })
  obtener(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ReservaDocument> {
    return this.bookingsService.obtenerDeUsuario(id, req.user.sub);
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva propia (libera el SlotHold)' })
  cancelar(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ReservaDocument> {
    return this.bookingsService.cancelar(id, req.user.sub);
  }
}
