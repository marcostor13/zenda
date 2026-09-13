import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, StreamableFile, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ActualizarRegistroServicioDto, CrearRegistroServicioDto, Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { ExpedientesService } from './expedientes.service';
import { InformePdfService } from './informe-pdf.service';
import { ExpedienteMascota, MascotaComercioResumen, RegistroExpediente } from './expediente.types';
import { archivoPdf } from './archivo-pdf';

interface RequestComercio extends Request {
  user: { sub: string; comercioId?: string };
}

/** Mascotas atendidas por el comercio y su historial de servicios. */
@ApiTags('comercio-mascotas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF)
@Controller('comercio/mascotas')
export class MascotasComercioController {
  constructor(
    private readonly expedientes: ExpedientesService,
    private readonly informes: InformePdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Mascotas con ficha que han reservado en el comercio' })
  listar(@Req() req: RequestComercio, @Query('q') busqueda?: string): Promise<MascotaComercioResumen[]> {
    return this.expedientes.listarMascotasComercio(comercioDe(req), busqueda);
  }

  @Get(':perroId')
  @ApiOperation({ summary: 'Ficha completa, reservas e historial de una mascota del comercio' })
  obtener(@Req() req: RequestComercio, @Param('perroId') perroId: string): Promise<ExpedienteMascota> {
    return this.expedientes.expedienteParaComercio(comercioDe(req), perroId);
  }

  @Post(':perroId/registros')
  @ApiOperation({ summary: 'Anotar lo que se hizo en un servicio' })
  crearRegistro(
    @Req() req: RequestComercio,
    @Param('perroId') perroId: string,
    @Body() dto: CrearRegistroServicioDto,
  ): Promise<RegistroExpediente> {
    return this.expedientes.crearRegistro({ comercioId: comercioDe(req), usuarioId: req.user.sub }, perroId, dto);
  }

  @Patch(':perroId/registros/:registroId')
  @ApiOperation({ summary: 'Corregir un registro propio' })
  actualizarRegistro(
    @Req() req: RequestComercio,
    @Param('perroId') perroId: string,
    @Param('registroId') registroId: string,
    @Body() dto: ActualizarRegistroServicioDto,
  ): Promise<RegistroExpediente> {
    return this.expedientes.actualizarRegistro(comercioDe(req), perroId, registroId, dto);
  }

  @Delete(':perroId/registros/:registroId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un registro propio' })
  eliminarRegistro(
    @Req() req: RequestComercio,
    @Param('perroId') perroId: string,
    @Param('registroId') registroId: string,
  ): Promise<void> {
    return this.expedientes.eliminarRegistro(comercioDe(req), perroId, registroId);
  }

  @Get(':perroId/informe')
  @ApiOperation({ summary: 'Informe PDF de la mascota' })
  async informe(@Req() req: RequestComercio, @Param('perroId') perroId: string): Promise<StreamableFile> {
    const comercioId = comercioDe(req);
    const [expediente, emisor] = await Promise.all([
      this.expedientes.expedienteParaComercio(comercioId, perroId),
      this.expedientes.nombreComercio(comercioId),
    ]);
    const pdf = await this.informes.generar({ emisor, destinatario: 'comercio', expediente });
    return archivoPdf(pdf, expediente.perro['nombre']);
  }
}

function comercioDe(req: RequestComercio): string {
  if (!req.user.comercioId) {
    throw new DomainException('Tu cuenta no está vinculada a ningún negocio', 403);
  }
  return req.user.comercioId;
}
