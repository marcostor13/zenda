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
import { JwtAuthGuard, PermiteInvitado } from '../auth/guards/jwt-auth.guard';
import { JwtOpcionalGuard } from '../auth/guards/jwt-opcional.guard';
import {
  CrearReservaDto, ComprobarDisponibilidadDto, DisponibilidadRespuesta,
  CalendarioDisponibilidadDto, parsearFechaPlataforma, ContactoInvitado,
} from 'shared';
import { CalendarioDisponibilidadRespuesta } from './bookings.service';
import { ReservaDocument } from './reserva.schema';

interface RequestConUsuario extends Request {
  user: { sub: string; email?: string; invitado?: boolean };
}

/** Rutas sin sesión obligatoria: `user` sólo está si vino un token válido. */
interface RequestOpcional extends Request {
  user?: { sub: string };
}

/*
 * El guard va en cada ruta y no en la clase: consultar la disponibilidad y el
 * calendario es público —el paso 1 de quien reserva como invitado todavía no
 * tiene sesión—, y un guard de clase se sumaría al de esas dos rutas.
 */
@ApiTags('reservas')
@ApiBearerAuth()
@Controller('reservas')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @PermiteInvitado()
  @ApiOperation({ summary: 'Crear una reserva (genera un SlotHold temporal)' })
  crear(@Body() dto: CrearReservaDto, @Req() req: RequestConUsuario): Promise<ReservaDocument> {
    return this.bookingsService.crear({
      usuarioId: req.user.sub,
      comercioId: dto.comercioId,
      servicioId: dto.servicioId,
      vertical: dto.vertical,
      perroId: dto.perroId,
      perroIdsAdicionales: dto.perroIdsAdicionales,
      fechaInicio: parsearFechaPlataforma(dto.fechaInicio),
      fechaFin: dto.fechaFin ? parsearFechaPlataforma(dto.fechaFin) : undefined,
      cantidad: dto.cantidad,
      detalle: dto.detalle,
      cuponCodigo: dto.cuponCodigo,
      recurrencia: dto.recurrencia
        ? {
            diasSemana: dto.recurrencia.diasSemana,
            hora: dto.recurrencia.hora,
            fechaFin: parsearFechaPlataforma(dto.recurrencia.fechaFin),
            mensual: dto.recurrencia.mensual,
          }
        : undefined,
      contactoInvitado: this.contactoInvitado(dto, req),
    });
  }

  /**
   * El email sale de la sesión y no del cuerpo: es adonde va la confirmación,
   * y aceptarlo del cliente permitiría mandarla a cualquier dirección.
   */
  private contactoInvitado(dto: CrearReservaDto, req: RequestConUsuario): ContactoInvitado | undefined {
    if (!req.user.invitado || !req.user.email) return undefined;
    return {
      nombre: dto.contacto?.nombre?.trim() ?? '',
      email: req.user.email,
      ...(dto.contacto?.telefono?.trim() ? { telefono: dto.contacto.telefono.trim() } : {}),
    };
  }

  @Post('disponibilidad')
  @UseGuards(JwtOpcionalGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '¿Se puede reservar este servicio con estos datos? No crea nada ni bloquea cupo',
  })
  comprobarDisponibilidad(
    @Body() dto: ComprobarDisponibilidadDto,
    @Req() req: RequestOpcional,
  ): Promise<DisponibilidadRespuesta> {
    return this.bookingsService.comprobarDisponibilidad({
      usuarioId: req.user?.sub,
      comercioId: dto.comercioId,
      servicioId: dto.servicioId,
      vertical: dto.vertical,
      perroId: dto.perroId,
      fechaInicio: parsearFechaPlataforma(dto.fechaInicio),
      fechaFin: dto.fechaFin ? parsearFechaPlataforma(dto.fechaFin) : undefined,
      cantidad: dto.cantidad,
      detalle: dto.detalle,
    });
  }

  @Get('disponibilidad/calendario')
  @UseGuards(JwtOpcionalGuard)
  @ApiOperation({
    summary: 'Días reservables de un servicio en un rango, para pintar el calendario',
  })
  calendarioDisponibilidad(
    @Query() consulta: CalendarioDisponibilidadDto,
    @Req() req: RequestOpcional,
  ): Promise<CalendarioDisponibilidadRespuesta> {
    return this.bookingsService.calendarioDisponibilidad({
      usuarioId: req.user?.sub,
      servicioId: consulta.servicioId,
      desde: new Date(consulta.desde),
      hasta: new Date(consulta.hasta),
      espacioId: consulta.espacioId,
    });
  }

  @Get('mis')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar las reservas del usuario autenticado' })
  misReservas(@Req() req: RequestConUsuario): Promise<ReservaDocument[]> {
    return this.bookingsService.listarPorUsuario(req.user.sub);
  }

  @Get('recordatorios')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Recordatorios de cuidado según el historial del usuario' })
  recordatorios(@Req() req: RequestConUsuario) {
    return this.bookingsService.recordatorios(req.user.sub);
  }

  @Get('puntos')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Puntos Doogking del usuario y progreso al próximo descuento' })
  puntos(@Req() req: RequestConUsuario) {
    return this.bookingsService.obtenerPuntos(req.user.sub);
  }

  @Get('proxima')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Próxima reserva confirmada del usuario, o null si no tiene ninguna' })
  proxima(@Req() req: RequestConUsuario) {
    return this.bookingsService.proxima(req.user.sub);
  }

  @Get('viaje/:reservaMadreId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Todas las reservas de un viaje: la principal y las vinculadas' })
  viaje(
    @Param('reservaMadreId') reservaMadreId: string,
    @Req() req: RequestConUsuario,
  ): Promise<ReservaDocument[]> {
    return this.bookingsService.listarViaje(reservaMadreId, req.user.sub);
  }

  // El invitado vuelve aquí al pagar: el código es suyo y no se adivina.
  @Get('codigo/:codigo')
  @UseGuards(JwtAuthGuard)
  @PermiteInvitado()
  @ApiOperation({ summary: 'Obtener una reserva propia por código (ej: RES-XXXXXXXX)' })
  obtenerPorCodigo(
    @Param('codigo') codigo: string,
    @Req() req: RequestConUsuario,
  ): Promise<ReservaDocument> {
    return this.bookingsService.obtenerPorCodigo(codigo, req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @PermiteInvitado()
  @ApiOperation({ summary: 'Obtener una reserva propia por id' })
  obtener(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ReservaDocument> {
    return this.bookingsService.obtenerDeUsuario(id, req.user.sub);
  }

  @Post(':id/cancelar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva propia (libera el SlotHold)' })
  cancelar(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ReservaDocument> {
    return this.bookingsService.cancelar(id, req.user.sub);
  }
}
