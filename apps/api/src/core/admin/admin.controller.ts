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
import { PermisosAdminGuard, PermisosAdmin } from '../auth/guards/permisos.guard';
import { ActualizarAlphaNivelDto, ActualizarComisionDto, EliminarComercioAdminDto, ImpactoBajaComercioDto, PermisoAdmin, ReporteFinancieroDto, ResultadoBajaComercioDto, Rol } from 'shared';

interface RequestConAdmin extends Request {
  user: { sub: string; rol: Rol };
}

/** Un filtro numérico vacío no es un 0: se queda sin aplicar. */
function numeroOpcional(valor?: string): number | undefined {
  if (valor === undefined || valor === '') return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermisosAdminGuard)
@Roles(Rol.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs del panel admin en un periodo + últimas reservas + comercios pendientes' })
  @ApiQuery({ name: 'desde', required: false, description: 'ISO; por defecto, inicio del mes en curso' })
  @ApiQuery({ name: 'hasta', required: false, description: 'ISO; por defecto, ahora' })
  obtenerDashboard(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const rango = desde && hasta ? { desde: new Date(desde), hasta: new Date(hasta) } : undefined;
    return this.adminService.obtenerDashboard(rango);
  }

  // ── Comisiones ───────────────────────────────────────────────────────────────

  @Get('comisiones')
  @ApiOperation({ summary: 'Listar todas las configuraciones de comisión por vertical' })
  listarComisiones() {
    return this.adminService.listarComisiones();
  }

  @PermisosAdmin(PermisoAdmin.CONFIGURACION)
  @Put('comisiones')
  @ApiOperation({ summary: 'Crear o actualizar comisión de un vertical' })
  actualizarComision(
    @Body() dto: ActualizarComisionDto,
    @Req() req: RequestConAdmin,
  ) {
    return this.adminService.actualizarComision(dto, req.user.sub);
  }

  // ── Doogking Alpha ───────────────────────────────────────────────────────────

  @Get('alpha')
  @ApiOperation({ summary: 'Listar la escalera de niveles Doogking Alpha' })
  listarNivelesAlpha() {
    return this.adminService.listarNivelesAlpha();
  }

  @PermisosAdmin(PermisoAdmin.CONFIGURACION)
  @Put('alpha')
  @ApiOperation({ summary: 'Crear o actualizar un nivel del programa Doogking Alpha' })
  actualizarNivelAlpha(
    @Body() dto: ActualizarAlphaNivelDto,
    @Req() req: RequestConAdmin,
  ) {
    return this.adminService.actualizarNivelAlpha(dto, req.user.sub);
  }

  // ── Comercios CRUD ───────────────────────────────────────────────────────────

  @Get('comercios')
  @ApiOperation({ summary: 'Listar comercios paginados con filtro por estado y búsqueda' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'estado', required: false, enum: ['pendiente', 'activo', 'suspendido'] })
  @ApiQuery({ name: 'buscar', required: false })
  @ApiQuery({ name: 'alphaAdherido', required: false, type: Boolean })
  listarComercios(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('estado') estado?: string,
    @Query('buscar') buscar?: string,
    @Query('alphaAdherido') alphaAdherido?: string,
  ) {
    // Sin el parámetro no se filtra; con él, 'true'/'false' explícitos.
    const adherido = alphaAdherido === undefined ? undefined : alphaAdherido === 'true';
    return this.adminService.listarComercios(page, limite, estado, buscar, adherido);
  }

  @Get('comercios/resumen')
  @ApiOperation({ summary: 'Contadores de comercios por estado y verificación' })
  resumenComercios() {
    return this.adminService.resumenComercios();
  }

  @Get('comercios/:id/ficha')
  @PermisosAdmin(PermisoAdmin.COMERCIOS, PermisoAdmin.SOPORTE)
  @ApiOperation({ summary: 'Ficha administrativa completa de un comercio' })
  fichaComercio(@Param('id') id: string) {
    return this.adminService.fichaComercio(id);
  }

  @PermisosAdmin(PermisoAdmin.COMERCIOS)
  @Post('comercios')
  @ApiOperation({ summary: 'Crear un comercio (admin)' })
  crearComercio(@Body() dto: {
    razonSocial: string;
    vatNumber: string;
    nombreComercial: string;
    verticales?: string[];
    plan?: string;
    estado?: string;
  }) {
    return this.adminService.crearComercio(dto as Parameters<AdminService['crearComercio']>[0]);
  }

  @PermisosAdmin(PermisoAdmin.COMERCIOS)
  @Patch('comercios/:id')
  @ApiOperation({ summary: 'Actualizar un comercio (admin)' })
  actualizarComercio(
    @Param('id') id: string,
    @Body() dto: {
      razonSocial?: string;
      nombreComercial?: string;
      verticales?: string[];
      plan?: string;
      estado?: string;
      comisionPctOverride?: number;
    },
  ) {
    return this.adminService.actualizarComercio(id, dto as Parameters<AdminService['actualizarComercio']>[1]);
  }

  @PermisosAdmin(PermisoAdmin.COMERCIOS)
  @Get('comercios/:id/impacto-baja')
  @ApiOperation({ summary: 'Qué arrastraría dar de baja o purgar un comercio' })
  impactoBajaComercio(@Param('id') id: string): Promise<ImpactoBajaComercioDto> {
    return this.adminService.impactoBajaComercio(id);
  }

  /**
   * Baja de un comercio. Por defecto es **lógica**: el negocio desaparece de la
   * web y su equipo pierde el acceso, pero reservas y pagos se conservan por
   * obligación contable. `purgar: true` borra de verdad y es irreversible; está
   * pensado para limpiar datos de prueba.
   */
  @PermisosAdmin(PermisoAdmin.COMERCIOS)
  @Delete('comercios/:id')
  @ApiOperation({ summary: 'Dar de baja (o purgar) un comercio y todo lo que cuelga de él' })
  async eliminarComercio(
    @Param('id') id: string,
    @Body() dto: EliminarComercioAdminDto,
    @Req() req: RequestConAdmin,
  ): Promise<ResultadoBajaComercioDto> {
    return this.adminService.eliminarComercio(
      id,
      { motivo: dto?.motivo, comentario: dto?.comentario, purgar: dto?.purgar },
      req.user.sub,
    );
  }

  @PermisosAdmin(PermisoAdmin.COMERCIOS)
  @Post('comercios/:id/restaurar')
  @ApiOperation({ summary: 'Deshacer la baja de un comercio (vuelve en pausa)' })
  restaurarComercio(@Param('id') id: string, @Req() req: RequestConAdmin) {
    return this.adminService.restaurarComercio(id, req.user.sub);
  }

  // ── Usuarios CRUD ────────────────────────────────────────────────────────────

  @Get('usuarios')
  @ApiOperation({ summary: 'Listar usuarios paginados con filtro por rol y búsqueda' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'rol', required: false })
  @ApiQuery({ name: 'buscar', required: false })
  @ApiQuery({ name: 'verificado', required: false, type: Boolean })
  listarUsuarios(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('rol') rol?: string,
    @Query('buscar') buscar?: string,
    @Query('verificado') verificado?: string,
  ) {
    const verificacion = verificado === undefined ? undefined : verificado === 'true';
    return this.adminService.listarUsuarios(page, limite, rol, buscar, verificacion);
  }

  @Get('usuarios/resumen')
  @ApiOperation({ summary: 'Contadores de usuarios por tipo y altas del mes' })
  resumenUsuarios() {
    return this.adminService.resumenUsuarios();
  }

  @PermisosAdmin(PermisoAdmin.USUARIOS)
  @Get('usuarios/:id/ficha')
  @PermisosAdmin(PermisoAdmin.USUARIOS, PermisoAdmin.SOPORTE)
  @ApiOperation({ summary: 'Ficha administrativa completa de una cuenta' })
  fichaUsuario(@Param('id') id: string) {
    return this.adminService.fichaUsuario(id);
  }

  @Post('usuarios')
  @ApiOperation({ summary: 'Crear un usuario (admin)' })
  crearUsuario(
    @Body() dto: { nombre: string; email: string; password: string; telefono?: string; rol?: Rol; comercioId?: string },
  ) {
    return this.adminService.crearUsuario(dto);
  }

  @PermisosAdmin(PermisoAdmin.USUARIOS)
  @Patch('usuarios/:id')
  @ApiOperation({ summary: 'Actualizar un usuario (admin)' })
  actualizarUsuario(
    @Param('id') id: string,
    @Body() dto: { nombre?: string; email?: string; telefono?: string; rol?: Rol; verificado?: boolean; comercioId?: string; permisosAdmin?: string[] },
    @Req() req: RequestConAdmin,
  ) {
    return this.adminService.actualizarUsuario(id, dto, req.user.sub);
  }

  @PermisosAdmin(PermisoAdmin.USUARIOS)
  @Delete('usuarios/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un usuario (admin)' })
  async eliminarUsuario(@Param('id') id: string, @Req() req: RequestConAdmin): Promise<void> {
    await this.adminService.eliminarUsuario(id, req.user.sub);
  }

  // ── Pagos y liquidaciones ────────────────────────────────────────────────────

  @PermisosAdmin(PermisoAdmin.FINANZAS)
  @Get('pagos')
  @ApiOperation({ summary: 'Pagos con su desglose: comisión, coste de pasarela y neto del comercio' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'comercioId', required: false })
  @ApiQuery({ name: 'buscar', required: false })
  listarPagos(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query('estado') estado?: string,
    @Query('comercioId') comercioId?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.adminService.listarPagos(page, limite, { estado, comercioId, buscar });
  }

  @PermisosAdmin(PermisoAdmin.FINANZAS)
  @Get('pagos/resumen')
  @ApiOperation({ summary: 'Totales de dinero cobrado, comisión, pasarela y liquidaciones' })
  resumenPagos() {
    return this.adminService.resumenPagos();
  }

  @Get('analitica/evolucion')
  @ApiOperation({ summary: 'Serie diaria de reservas y facturación' })
  @ApiQuery({ name: 'dias', required: false })
  evolucion(@Query('dias', new DefaultValuePipe(30), ParseIntPipe) dias: number) {
    return this.adminService.evolucion(dias);
  }

  // ── Reservas ─────────────────────────────────────────────────────────────────

  @Get('reservas/resumen')
  @ApiOperation({ summary: 'Contadores por estado e importes globales de reservas' })
  resumenReservas() {
    return this.adminService.resumenReservas();
  }

  @Get('reservas')
  @ApiOperation({ summary: 'Listar reservas paginadas (filtros: estado, comercio, código, fechas)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limite', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'comercioId', required: false })
  @ApiQuery({ name: 'buscar', required: false })
  @ApiQuery({ name: 'fechaDesde', required: false })
  @ApiQuery({ name: 'fechaHasta', required: false })
  @ApiQuery({ name: 'vertical', required: false })
  @ApiQuery({ name: 'ciudad', required: false })
  @ApiQuery({ name: 'estadoPago', required: false })
  @ApiQuery({ name: 'importeMin', required: false })
  @ApiQuery({ name: 'importeMax', required: false })
  listarReservas(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
    @Query() filtros: Record<string, string | undefined>,
  ) {
    return this.adminService.listarReservas(page, limite, {
      estado: filtros['estado'],
      comercioId: filtros['comercioId'],
      buscar: filtros['buscar'],
      fechaDesde: filtros['fechaDesde'],
      fechaHasta: filtros['fechaHasta'],
      vertical: filtros['vertical'],
      ciudad: filtros['ciudad'],
      estadoPago: filtros['estadoPago'],
      importeMin: numeroOpcional(filtros['importeMin']),
      importeMax: numeroOpcional(filtros['importeMax']),
    });
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

  @PermisosAdmin(PermisoAdmin.FINANZAS)
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
