import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CrearSolicitudPresupuestoDto, RechazarPresupuestoDto, ResponderPresupuestoDto, Rol,
  SolicitudPresupuestoComercioVista, SolicitudPresupuestoVista,
} from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { PresupuestosService } from './presupuestos.service';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

/** Lado del cliente: pedir, ver y cancelar presupuestos. */
@ApiTags('presupuestos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestos: PresupuestosService) {}

  @Post()
  @ApiOperation({ summary: 'Pedir presupuesto a una o varias empresas, con los datos ya descritos' })
  crear(@Body() dto: CrearSolicitudPresupuestoDto, @Req() req: RequestConUsuario): Promise<SolicitudPresupuestoVista> {
    return this.presupuestos.crear(req.user.sub, dto);
  }

  @Get('mis')
  @ApiOperation({ summary: 'Solicitudes de presupuesto del cliente, con las respuestas' })
  mis(@Req() req: RequestConUsuario): Promise<SolicitudPresupuestoVista[]> {
    return this.presupuestos.misSolicitudes(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Una solicitud de presupuesto propia' })
  obtener(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<SolicitudPresupuestoVista> {
    return this.presupuestos.deUsuario(id, req.user.sub);
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retirar una solicitud de presupuesto' })
  cancelar(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<SolicitudPresupuestoVista> {
    return this.presupuestos.cancelar(id, req.user.sub);
  }
}

/** Lado del comercio: bandeja de solicitudes y respuesta con precio. */
@ApiTags('presupuestos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
@Controller('comercios/mis-presupuestos')
export class PresupuestosComercioController {
  constructor(private readonly presupuestos: PresupuestosService) {}

  @Get()
  @ApiOperation({ summary: 'Solicitudes de presupuesto recibidas por el comercio' })
  bandeja(@Req() req: RequestConUsuario): Promise<SolicitudPresupuestoComercioVista[]> {
    return this.presupuestos.bandejaComercio(this.comercioDe(req));
  }

  @Post(':id/servicios/:servicioId/responder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Responder con precio final y condiciones' })
  responder(
    @Param('id') id: string,
    @Param('servicioId') servicioId: string,
    @Body() dto: ResponderPresupuestoDto,
    @Req() req: RequestConUsuario,
  ): Promise<SolicitudPresupuestoComercioVista[]> {
    return this.presupuestos.responder(id, this.comercioDe(req), servicioId, dto);
  }

  @Post(':id/servicios/:servicioId/rechazar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Declinar la solicitud' })
  rechazar(
    @Param('id') id: string,
    @Param('servicioId') servicioId: string,
    @Body() dto: RechazarPresupuestoDto,
    @Req() req: RequestConUsuario,
  ): Promise<SolicitudPresupuestoComercioVista[]> {
    return this.presupuestos.rechazar(id, this.comercioDe(req), servicioId, dto.motivo);
  }

  private comercioDe(req: RequestConUsuario): string {
    // RolesGuard ya exige rol de comercio; un staff sin comercio sería un dato roto.
    return req.user.comercioId ?? '';
  }
}
