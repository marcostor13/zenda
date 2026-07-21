import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ActualizarComisionDto, ReporteFinancieroDto, Rol } from 'shared';

interface RequestConAdmin extends Request {
  user: { sub: string; rol: Rol };
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs globales del panel admin + últimas reservas + comercios pendientes' })
  obtenerDashboard() {
    return this.adminService.obtenerDashboard();
  }

  // ── Comisiones ───────────────────────────────────────────────────────────────

  @Get('comisiones')
  @ApiOperation({ summary: 'Listar todas las configuraciones de comisión por vertical' })
  listarComisiones() {
    return this.adminService.listarComisiones();
  }

  @Put('comisiones')
  @ApiOperation({ summary: 'Crear o actualizar comisión de un vertical' })
  actualizarComision(
    @Body() dto: ActualizarComisionDto,
    @Req() req: RequestConAdmin,
  ) {
    return this.adminService.actualizarComision(dto, req.user.sub);
  }

  // ── Comercios CRUD ───────────────────────────────────────────────────────────

  @Get('comercios')
  @ApiOperation({ summary: 'Listar comercios paginados con filtro por estado y búsqueda' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'estado', required: false, enum: ['pendiente', 'activo', 'suspendido'] })
  @ApiQuery({ name: 'buscar', required: false })
  listarComercios(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('estado') estado?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.adminService.listarComercios(page, limite, estado, buscar);
  }

  @Post('comercios')
  @ApiOperation({ summary: 'Crear un comercio (admin)' })
  crearComercio(@Body() dto: {
    razonSocial: string;
    vatNumber: string;
    nombreComercial: string;
    logoUrl?: string;
    verticales?: string[];
    plan?: string;
    estado?: string;
  }) {
    return this.adminService.crearComercio(dto as Parameters<AdminService['crearComercio']>[0]);
  }

  @Patch('comercios/:id')
  @ApiOperation({ summary: 'Actualizar un comercio (admin)' })
  actualizarComercio(
    @Param('id') id: string,
    @Body() dto: {
      razonSocial?: string;
      nombreComercial?: string;
      logoUrl?: string;
      verticales?: string[];
      plan?: string;
      estado?: string;
      comisionPctOverride?: number;
    },
  ) {
    return this.adminService.actualizarComercio(id, dto as Parameters<AdminService['actualizarComercio']>[1]);
  }

  @Patch('comercios/:id/verificacion')
  @ApiOperation({ summary: 'Verificar o rechazar la documentación de un comercio' })
  cambiarVerificacionComercio(
    @Param('id') id: string,
    @Body() dto: { estado: 'verificado' | 'rechazado' | 'pendiente'; motivo?: string },
  ) {
    return this.adminService.cambiarVerificacionComercio(id, dto.estado, dto.motivo);
  }

  @Delete('comercios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un comercio (admin)' })
  async eliminarComercio(@Param('id') id: string): Promise<void> {
    await this.adminService.eliminarComercio(id);
  }

  // ── Usuarios CRUD ────────────────────────────────────────────────────────────

  @Get('usuarios')
  @ApiOperation({ summary: 'Listar usuarios paginados con filtro por rol y búsqueda' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'rol', required: false })
  @ApiQuery({ name: 'buscar', required: false })
  listarUsuarios(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('rol') rol?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.adminService.listarUsuarios(page, limite, rol, buscar);
  }

  @Post('usuarios')
  @ApiOperation({ summary: 'Crear un usuario (admin)' })
  crearUsuario(
    @Body() dto: { nombre: string; email: string; password: string; telefono?: string; rol?: Rol; comercioId?: string },
  ) {
    return this.adminService.crearUsuario(dto);
  }

  @Patch('usuarios/:id')
  @ApiOperation({ summary: 'Actualizar un usuario (admin)' })
  actualizarUsuario(
    @Param('id') id: string,
    @Body() dto: { nombre?: string; email?: string; telefono?: string; rol?: Rol; verificado?: boolean; comercioId?: string },
  ) {
    return this.adminService.actualizarUsuario(id, dto);
  }

  @Delete('usuarios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un usuario (admin)' })
  async eliminarUsuario(@Param('id') id: string): Promise<void> {
    await this.adminService.eliminarUsuario(id);
  }

  // ── Reservas ─────────────────────────────────────────────────────────────────

  @Get('reservas')
  @ApiOperation({ summary: 'Listar reservas paginadas (filtros: estado, comercio, código, fechas)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'comercioId', required: false })
  @ApiQuery({ name: 'buscar', required: false })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  listarReservas(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('estado') estado?: string,
    @Query('comercioId') comercioId?: string,
    @Query('buscar') buscar?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
  ) {
    return this.adminService.listarReservas(page, limite, { estado, comercioId, buscar, fechaDesde, fechaHasta });
  }

  @Patch('reservas/:id/estado')
  @ApiOperation({ summary: 'Cambiar el estado operativo de una reserva (reembolsar, liberar pago, disputa…)' })
  cambiarEstadoReserva(
    @Param('id') id: string,
    @Body() dto: { estado: string; motivo?: string },
    @Req() req: RequestConAdmin,
  ) {
    return this.adminService.cambiarEstadoReserva(id, dto.estado, req.user.sub, dto.motivo);
  }

  // ── Analítica ────────────────────────────────────────────────────────────────

  @Get('analitica')
  @ApiOperation({ summary: 'Analítica global: distribución por vertical/ciudad, top comercios y embudo' })
  obtenerAnalitica() {
    return this.adminService.obtenerAnalitica();
  }

  // ── Reportes financieros ─────────────────────────────────────────────────────

  @Get('reportes/financiero')
  @ApiOperation({ summary: 'Reporte financiero: GMV, comisiones, Stripe fees, margen neto' })
  @ApiQuery({ name: 'fechaDesde', type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'fechaHasta', type: String, example: '2026-12-31' })
  @ApiQuery({ name: 'vertical', required: false })
  @ApiQuery({ name: 'comercioId', required: false })
  async reporteFinanciero(
    @Query('fechaDesde') fechaDesde: string,
    @Query('fechaHasta') fechaHasta: string,
    @Query('vertical') vertical?: string,
    @Query('comercioId') comercioId?: string,
  ): Promise<ReporteFinancieroDto> {
    return this.adminService.generarReporteFinanciero({
      fechaDesde: new Date(fechaDesde),
      fechaHasta: new Date(fechaHasta),
      vertical,
      comercioId,
    });
  }
}
