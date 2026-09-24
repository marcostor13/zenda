import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResolverAceptacionDto, Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { BookingsService } from '../bookings/bookings.service';
import { ReservaDocument } from '../bookings/reserva.schema';
import { CancelacionesService, VistaPreviaCancelacion } from './cancelaciones.service';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

/** El cliente consulta cuánto le devolverían y cancela. */
@ApiTags('reservas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservas')
export class CancelacionesController {
  constructor(private readonly cancelaciones: CancelacionesService) {}

  @Get(':id/cancelacion')
  @ApiOperation({ summary: 'Cuánto se devolvería si se cancela ahora, según la política' })
  vistaPrevia(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<VistaPreviaCancelacion> {
    return this.cancelaciones.vistaPrevia(id, req.user.sub);
  }

  @Post(':id/cancelacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar una reserva propia con el reembolso que marque la política' })
  cancelar(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ReservaDocument> {
    return this.cancelaciones.cancelarPorCliente(id, req.user.sub);
  }
}

/** El comercio acepta o rechaza un viaje pagado que necesitaba su visto bueno (E4). */
@ApiTags('comercios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
@Controller('comercios/mis-reservas')
export class AceptacionesController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly cancelaciones: CancelacionesService,
  ) {}

  @Post(':reservaId/aceptacion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar (con la hora real) o rechazar un viaje; al rechazar se devuelve todo' })
  resolver(
    @Param('reservaId') reservaId: string,
    @Body() dto: ResolverAceptacionDto,
    @Req() req: RequestConUsuario,
  ): Promise<ReservaDocument> {
    const comercioId = req.user.comercioId ?? '';
    return dto.decision === 'aceptar'
      ? this.bookings.aceptarViaje(reservaId, comercioId, dto.horaConfirmada)
      : this.cancelaciones.rechazarViaje(reservaId, comercioId, dto.motivo);
  }
}
