import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ComerciosService } from './comercios.service';
import { ComercioDocument, EstadoComercio } from './comercio.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { RegistrarComercioDto, RegistroComercioDto, AuthResponseDto, ActualizarDisponibilidadDto, CambiarEstadoComercioDto, ActualizarPerfilComercioDto, Rol } from 'shared';

interface RequestConUser extends Request {
  user: { sub: string; comercioId?: string };
}

@ApiTags('comercios')
@Controller('comercios')
export class ComerciosController {
  constructor(private readonly comerciosService: ComerciosService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar un comercio (queda pendiente de aprobación)' })
  registrar(@Body() dto: RegistrarComercioDto): Promise<ComercioDocument> {
    return this.comerciosService.registrar(dto);
  }

  @Post('registro')
  @ApiOperation({ summary: 'Alta de comercio en un solo paso (cuenta + negocio); devuelve sesión' })
  registrarConCuenta(@Body() dto: RegistroComercioDto): Promise<AuthResponseDto> {
    return this.comerciosService.registrarConCuenta(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar comercios (admin), opcionalmente por estado' })
  @ApiQuery({ name: 'estado', required: false, enum: ['pendiente', 'activo', 'suspendido'] })
  listar(@Query('estado') estado?: EstadoComercio): Promise<ComercioDocument[]> {
    return this.comerciosService.listar(estado);
  }

  @Get('mi-comercio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener el comercio del usuario autenticado' })
  miComercio(@Req() req: RequestConUser): Promise<ComercioDocument> {
    return this.comerciosService.obtener(req.user.comercioId!);
  }

  @Get('mis-reservas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reservas del comercio autenticado (últimas 50)' })
  misReservas(@Req() req: RequestConUser) {
    return this.comerciosService.obtenerReservasComercio(req.user.comercioId!, 50);
  }

  @Patch('mis-reservas/:reservaId/completar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar una reserva confirmada como completada (servicio ya prestado)' })
  completarReserva(@Req() req: RequestConUser, @Param('reservaId') reservaId: string) {
    return this.comerciosService.completarReserva(reservaId, req.user.comercioId!);
  }

  @Get('mis-servicios')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Servicios del comercio autenticado' })
  misServicios(@Req() req: RequestConUser) {
    return this.comerciosService.obtenerServiciosComercio(req.user.comercioId!);
  }

  @Patch('mis-servicios/:servicioId/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar estado de un servicio propio' })
  cambiarEstadoServicio(
    @Req() req: RequestConUser,
    @Param('servicioId') servicioId: string,
    @Body() dto: { estado: 'publicado' | 'pausado' | 'borrador' },
  ) {
    return this.comerciosService.cambiarEstadoServicio(servicioId, req.user.comercioId!, dto.estado);
  }

  @Patch('mis-servicios/:servicioId/disponibilidad')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar la disponibilidad/cupos de un servicio propio (evita sobreventa)' })
  actualizarDisponibilidad(
    @Req() req: RequestConUser,
    @Param('servicioId') servicioId: string,
    @Body() dto: ActualizarDisponibilidadDto,
  ) {
    return this.comerciosService.actualizarDisponibilidadServicio(servicioId, req.user.comercioId!, dto);
  }

  @Get('mis-resenas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reseñas recibidas por el comercio autenticado' })
  misResenas(@Req() req: RequestConUser) {
    return this.comerciosService.obtenerResenasComercio(req.user.comercioId!);
  }

  @Patch('mis-resenas/:resenaId/respuesta')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Responder a una reseña recibida' })
  responderResena(
    @Req() req: RequestConUser,
    @Param('resenaId') resenaId: string,
    @Body('respuesta') respuesta: string,
  ) {
    return this.comerciosService.responderResena(resenaId, req.user.comercioId!, respuesta);
  }

  @Patch('mi-comercio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar el perfil del comercio autenticado (datos, ubicación, contacto, banco, etc.)' })
  actualizarMiComercio(
    @Req() req: RequestConUser,
    @Body() dto: ActualizarPerfilComercioDto,
  ) {
    return this.comerciosService.actualizarComercio(req.user.comercioId!, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener un comercio por id' })
  obtener(@Param('id') id: string): Promise<ComercioDocument> {
    return this.comerciosService.obtener(id);
  }

  @Patch(':id/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aprobar/suspender un comercio (admin)' })
  cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoComercioDto,
  ): Promise<ComercioDocument> {
    return this.comerciosService.cambiarEstado(id, dto.estado);
  }
}
