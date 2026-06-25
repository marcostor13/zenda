import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ComerciosService } from './comercios.service';
import { ComercioDocument, EstadoComercio } from './comercio.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { RegistrarComercioDto, CambiarEstadoComercioDto, Rol } from 'shared';

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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar comercios (admin), opcionalmente por estado' })
  @ApiQuery({ name: 'estado', required: false, enum: ['pendiente', 'activo', 'suspendido'] })
  listar(@Query('estado') estado?: EstadoComercio): Promise<ComercioDocument[]> {
    return this.comerciosService.listar(estado);
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
