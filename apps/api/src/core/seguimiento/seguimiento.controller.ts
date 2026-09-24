import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PosicionViajeDto, Rol, UbicacionViajeRespuesta } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { ContactoReserva, SeguimientoService } from './seguimiento.service';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

/** Lado del cliente: dónde va el vehículo y cómo contactar. */
@ApiTags('reservas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservas')
export class SeguimientoClienteController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  // El mapa pregunta cada pocos segundos mientras está abierto.
  @Get(':id/ubicacion')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Última posición del vehículo y rastro reciente del viaje' })
  ubicacion(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<UbicacionViajeRespuesta> {
    return this.seguimiento.ubicacion(id, req.user.sub);
  }

  @Get(':id/contacto')
  @ApiOperation({ summary: 'Teléfono y WhatsApp del comercio de una reserva confirmada' })
  contacto(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ContactoReserva> {
    return this.seguimiento.contacto(id, req.user.sub);
  }
}

/** Lado del conductor: comparte su posición mientras dura el viaje. */
@ApiTags('comercios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
@Controller('comercios/mis-reservas')
export class SeguimientoComercioController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  @Post(':reservaId/posicion')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Enviar la posición actual del vehículo' })
  posicion(
    @Param('reservaId') reservaId: string,
    @Body() dto: PosicionViajeDto,
    @Req() req: RequestConUsuario,
  ): Promise<{ ok: true }> {
    return this.seguimiento.registrarPosicion(reservaId, req.user.comercioId ?? '', dto);
  }
}
