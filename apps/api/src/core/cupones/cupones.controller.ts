import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CuponesService, DescuentoAplicado } from './cupones.service';
import { CuponesRepository } from './cupones.repository';
import { CuponDocument } from './cupon.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ValidarCuponDto, CrearCuponDto, Rol } from 'shared';

@ApiTags('cupones')
@Controller('cupones')
export class CuponesController {
  constructor(
    private readonly cuponesService: CuponesService,
    private readonly cuponesRepo: CuponesRepository,
  ) {}

  @Post('validar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar un cupón y previsualizar el descuento' })
  validar(@Body() dto: ValidarCuponDto): Promise<DescuentoAplicado> {
    return this.cuponesService.validar(dto.codigo, dto.vertical, dto.montoSubtotal);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un cupón (admin)' })
  crear(@Body() dto: CrearCuponDto): Promise<CuponDocument> {
    return this.cuponesRepo.crear({
      ...dto,
      vertical: dto.vertical ?? 'global',
      validoHasta: dto.validoHasta ? new Date(dto.validoHasta) : undefined,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Rol.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar cupones (admin)' })
  listar(): Promise<CuponDocument[]> {
    return this.cuponesRepo.listar();
  }
}
