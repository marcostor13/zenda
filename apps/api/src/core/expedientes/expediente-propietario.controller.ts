import { Controller, Get, Param, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpedientesService } from './expedientes.service';
import { InformePdfService } from './informe-pdf.service';
import { ExpedienteMascota } from './expediente.types';
import { archivoPdf } from './archivo-pdf';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

/**
 * Expediente de la mascota visto por su dueño. Comparte el prefijo `perros` con
 * `PerrosController`, pero vive en este módulo porque necesita comercios y
 * servicios, y `catalog` ya importa `perros` (sería un ciclo).
 */
@ApiTags('perros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('perros')
export class ExpedientePropietarioController {
  constructor(
    private readonly expedientes: ExpedientesService,
    private readonly informes: InformePdfService,
  ) {}

  @Get(':id/expediente')
  @ApiOperation({ summary: 'Ficha completa de un perro propio con el historial de sus servicios' })
  obtener(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ExpedienteMascota> {
    return this.expedientes.expedienteParaPropietario(req.user.sub, id);
  }

  @Get(':id/informe')
  @ApiOperation({ summary: 'Informe PDF de la ficha y el historial de un perro propio' })
  async informe(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<StreamableFile> {
    const expediente = await this.expedientes.expedienteParaPropietario(req.user.sub, id);
    const pdf = await this.informes.generar({ emisor: 'Doogking', destinatario: 'propietario', expediente });
    return archivoPdf(pdf, expediente.perro['nombre']);
  }
}
