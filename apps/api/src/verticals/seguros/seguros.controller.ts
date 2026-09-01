import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Rol } from 'shared';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../core/auth/guards/roles.guard';
import { PolizaDocument } from './poliza.schema';
import {
  ListadoSolicitudesSeguros, PolizaRecomendada, SegurosService, SolicitudSegurosAdmin,
} from './seguros.service';

interface RequestConUsuario extends Request {
  user: { sub: string; comercioId?: string };
}

class ContratarPolizaDto {
  @IsString()
  servicioId!: string;

  @IsString()
  perroId!: string;

  @IsOptional()
  @IsString()
  reservaId?: string;

  @IsBoolean()
  declaracionVeracidadAceptada!: boolean;
}

class RechazarSolicitudDto {
  @IsString()
  motivo!: string;
}

class ValidarPolizaDto {
  @IsBoolean()
  aceptada!: boolean;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}

@ApiTags('seguros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('seguros')
export class SegurosController {
  constructor(private readonly segurosService: SegurosService) {}

  @Get('recomendaciones/:perroId')
  @ApiOperation({ summary: 'Seguros recomendados para una mascota, con el descuento de bienestar' })
  recomendaciones(
    @Param('perroId') perroId: string,
    @Req() req: RequestConUsuario,
  ): Promise<PolizaRecomendada[]> {
    return this.segurosService.recomendarPara(perroId, req.user.sub);
  }

  @Get('polizas/mis')
  @ApiOperation({ summary: 'Pólizas contratadas por el usuario' })
  misPolizas(@Req() req: RequestConUsuario): Promise<PolizaDocument[]> {
    return this.segurosService.listarDeUsuario(req.user.sub);
  }

  @Post('polizas')
  @ApiOperation({ summary: 'Contratar una póliza (queda pendiente de validación de la aseguradora)' })
  contratar(
    @Body() dto: ContratarPolizaDto,
    @Req() req: RequestConUsuario,
  ): Promise<PolizaDocument> {
    return this.segurosService.contratar({ ...dto, usuarioId: req.user.sub });
  }

  // ── Alta de aseguradoras (solo administración) ─────────────────────

  @Get('solicitudes')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Solicitudes de alta de aseguradoras, con su documentación y el cupo libre' })
  solicitudes(): Promise<ListadoSolicitudesSeguros> {
    return this.segurosService.listarSolicitudes();
  }

  @Patch('solicitudes/:id/aprobar')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Aprobar la solicitud y publicar la ficha de la aseguradora' })
  aprobarSolicitud(@Param('id') id: string): Promise<SolicitudSegurosAdmin> {
    return this.segurosService.aprobarSolicitud(id);
  }

  @Patch('solicitudes/:id/rechazar')
  @UseGuards(RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'No aprobar la solicitud, indicando el motivo' })
  rechazarSolicitud(
    @Param('id') id: string,
    @Body() dto: RechazarSolicitudDto,
  ): Promise<SolicitudSegurosAdmin> {
    return this.segurosService.rechazarSolicitud(id, dto.motivo);
  }

  @Patch('polizas/:id/validar')
  @UseGuards(RolesGuard)
  @Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
  @ApiOperation({ summary: 'La aseguradora confirma o rechaza la cobertura tras revisar los datos' })
  validar(
    @Param('id') id: string,
    @Body() dto: ValidarPolizaDto,
    @Req() req: RequestConUsuario,
  ): Promise<PolizaDocument> {
    return this.segurosService.validar(id, req.user.comercioId!, dto.aceptada, dto.motivoRechazo);
  }
}
