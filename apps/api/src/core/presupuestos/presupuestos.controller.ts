import {
  Body, Controller, Get, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  EstadoPresupuesto, OfertarPresupuestoDto, PresupuestoDto, RechazarPresupuestoDto, Rol,
  SolicitarPresupuestoDto,
} from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PresupuestoDocument } from './presupuesto.schema';
import { PresupuestosService } from './presupuestos.service';

interface RequestConUser extends Request {
  user: { sub: string; comercioId?: string };
}

/** Del documento a lo que consume el frontend; nada de exponer el documento crudo. */
function aDto(p: PresupuestoDocument): PresupuestoDto {
  return {
    id: String(p._id),
    codigo: p.codigo,
    vertical: p.vertical,
    servicioId: String(p.servicioId),
    comercioId: String(p.comercioId),
    estado: p.estado,
    fechaServicio: p.fechaServicio.toISOString(),
    solicitud: p.solicitud,
    importe: p.importe,
    moneda: p.moneda,
    condiciones: p.condiciones,
    validoHasta: p.validoHasta?.toISOString(),
    reservaId: p.reservaId ? String(p.reservaId) : undefined,
    createdAt: (p as unknown as { createdAt: Date }).createdAt?.toISOString()
      ?? new Date().toISOString(),
  };
}

@ApiTags('presupuestos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestos: PresupuestosService) {}

  @Post()
  @ApiOperation({ summary: 'Pedir un presupuesto a medida para un servicio' })
  async solicitar(
    @Req() req: RequestConUser,
    @Body() dto: SolicitarPresupuestoDto,
  ): Promise<PresupuestoDto> {
    return aDto(await this.presupuestos.solicitar({
      usuarioId: req.user.sub,
      servicioId: dto.servicioId,
      perroId: dto.perroId,
      fechaServicio: new Date(dto.fechaServicio),
      solicitud: dto.solicitud,
    }));
  }

  @Get('mis')
  @ApiOperation({ summary: 'Mis presupuestos, pendientes y resueltos' })
  async mis(@Req() req: RequestConUser): Promise<PresupuestoDto[]> {
    return (await this.presupuestos.misPresupuestos(req.user.sub)).map(aDto);
  }

  // Antes que ':id': si no, "comercio" se leería como el id de un presupuesto.
  @Get('comercio')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Solicitudes de presupuesto recibidas por mi negocio' })
  async delComercio(
    @Req() req: RequestConUser,
    @Query('estado') estado?: EstadoPresupuesto,
  ): Promise<PresupuestoDto[]> {
    if (!req.user.comercioId) throw new DomainException('Tu cuenta no tiene negocio asociado', 403);
    return (await this.presupuestos.delComercio(req.user.comercioId, estado)).map(aDto);
  }

  @Post(':id/oferta')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'Responder con el importe y las condiciones del servicio' })
  async ofertar(
    @Req() req: RequestConUser,
    @Param('id') id: string,
    @Body() dto: OfertarPresupuestoDto,
  ): Promise<PresupuestoDto> {
    if (!req.user.comercioId) throw new DomainException('Tu cuenta no tiene negocio asociado', 403);
    return aDto(await this.presupuestos.ofertar(id, req.user.comercioId, dto));
  }

  @Post(':id/aceptar')
  @ApiOperation({ summary: 'Aceptar la oferta; crea la reserva pendiente de pago' })
  async aceptar(@Req() req: RequestConUser, @Param('id') id: string): Promise<PresupuestoDto> {
    return aDto(await this.presupuestos.aceptar(id, req.user.sub));
  }

  @Post(':id/rechazar')
  @ApiOperation({ summary: 'Rechazar la oferta recibida' })
  async rechazar(
    @Req() req: RequestConUser,
    @Param('id') id: string,
    @Body() dto: RechazarPresupuestoDto,
  ): Promise<PresupuestoDto> {
    return aDto(await this.presupuestos.rechazar(id, req.user.sub, dto.motivo));
  }
}
