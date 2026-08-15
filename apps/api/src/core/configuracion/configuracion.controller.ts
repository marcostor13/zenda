import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PermisoAdmin, Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { PermisosAdminGuard, PermisosAdmin } from '../auth/guards/permisos.guard';
import { ConfiguracionPlataforma, ConfiguracionPlataformaDocument } from './configuracion.schema';
import { ConfiguracionService } from './configuracion.service';

interface RequestConAdmin extends Request {
  user: { sub: string; rol: Rol };
}

@ApiTags('configuracion')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  /**
   * Pública a propósito: el frontend necesita saber si hay mantenimiento o qué
   * verticales están abiertos antes de que nadie haya iniciado sesión.
   */
  @Get('publica')
  @ApiOperation({ summary: 'Ajustes que el público necesita conocer' })
  async publica(): Promise<{ modoMantenimiento: boolean; mensajeMantenimiento?: string; verticalesActivos: string[] }> {
    const config = await this.configuracionService.obtener();
    return {
      modoMantenimiento: config.modoMantenimiento,
      mensajeMantenimiento: config.mensajeMantenimiento,
      verticalesActivos: config.verticalesActivos,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermisosAdminGuard)
  @Roles(Rol.ADMIN)
  @PermisosAdmin(PermisoAdmin.CONFIGURACION)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configuración completa de la plataforma' })
  obtener(): Promise<ConfiguracionPlataformaDocument> {
    return this.configuracionService.obtener();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard, PermisosAdminGuard)
  @Roles(Rol.ADMIN)
  @PermisosAdmin(PermisoAdmin.CONFIGURACION)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar la configuración de la plataforma' })
  actualizar(
    @Body() dto: Partial<ConfiguracionPlataforma>,
    @Req() req: RequestConAdmin,
  ): Promise<ConfiguracionPlataformaDocument> {
    return this.configuracionService.actualizar(dto, req.user.sub);
  }
}
