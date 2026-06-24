import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Req,
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

  // ── Comisiones ──────────────────────────────────────────────────────────────

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

  // ── Reportes financieros ─────────────────────────────────────────────────────

  @Get('reportes/financiero')
  @ApiOperation({ summary: 'Reporte financiero: GMV, comisiones, Stripe fees, margen neto' })
  @ApiQuery({ name: 'fechaDesde', type: String, example: '2025-01-01' })
  @ApiQuery({ name: 'fechaHasta', type: String, example: '2025-01-31' })
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
