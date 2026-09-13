import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExpedientesService } from './expedientes.service';
import { ExpedienteMascota } from './expediente.types';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

/**
 * Expediente de la mascota visto por su dueño. Comparte el prefijo `perros` con
 * `PerrosController`, pero vive en este módulo porque necesita comercios y
 * servicios, y `catalog` ya importa `perros` (sería un ciclo). El PDF del dueño
 * lo sirve `PerrosController` en `GET /perros/:id/informe`.
 */
@ApiTags('perros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('perros')
export class ExpedientePropietarioController {
  constructor(private readonly expedientes: ExpedientesService) {}

  @Get(':id/expediente')
  @ApiOperation({ summary: 'Ficha completa de un perro propio con el historial de sus servicios' })
  obtener(@Param('id') id: string, @Req() req: RequestConUsuario): Promise<ExpedienteMascota> {
    return this.expedientes.expedienteParaPropietario(req.user.sub, id);
  }
}
