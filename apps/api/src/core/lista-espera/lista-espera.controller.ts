import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ListaEsperaItemDto,
  Rol,
  SuscribirListaEsperaDto,
  SuscripcionListaEsperaDto,
} from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { ListaEsperaService } from './lista-espera.service';

@ApiTags('lista-espera')
@Controller('lista-espera')
export class ListaEsperaController {
  constructor(private readonly listaEsperaService: ListaEsperaService) {}

  // Público a propósito: es el formulario de la pantalla "muy pronto", que se
  // sirve antes de que exista ninguna sesión.
  @Post()
  @HttpCode(HttpStatus.OK)
  // Escribe en BD sin sesión: sin techo es una vía directa a llenar la colección.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Apuntarse a la lista de espera del lanzamiento' })
  suscribir(@Body() dto: SuscribirListaEsperaDto): Promise<SuscripcionListaEsperaDto> {
    return this.listaEsperaService.suscribir(dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Listar los emails apuntados a la lista de espera (admin)' })
  listar(): Promise<{ total: number; items: ListaEsperaItemDto[] }> {
    return this.listaEsperaService.listar();
  }
}
