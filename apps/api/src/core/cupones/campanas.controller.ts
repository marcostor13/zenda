import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Rol } from 'shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CampanaDocument } from './campana.schema';
import { CampanasService, MetricasCampana } from './campanas.service';
import { ObjetivoCampana, SegmentoCampana } from 'shared';

interface RequestConUsuario extends Request {
  user: { sub: string };
}

class GuardarCampanaDto {
  @IsString() @MinLength(2)
  nombre!: string;

  @IsOptional() @IsString()
  descripcion?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  canales?: string[];

  @IsDateString()
  desde!: string;

  @IsDateString()
  hasta!: string;

  @IsOptional() @IsBoolean()
  activa?: boolean;

  /** Para qué se lanza y a quién se dirige (TCK-8038 §3 y §4). */
  @IsOptional() @IsEnum(ObjetivoCampana)
  objetivo?: ObjetivoCampana;

  @IsOptional() @IsEnum(SegmentoCampana)
  segmento?: SegmentoCampana;

  @IsOptional() @IsString()
  segmentoDetalle?: string;
}

@ApiTags('campanas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.ADMIN)
@Controller('campanas')
export class CampanasController {
  constructor(private readonly campanasService: CampanasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar campañas de marketing' })
  listar(): Promise<CampanaDocument[]> {
    return this.campanasService.listar();
  }

  @Get('metricas')
  @ApiOperation({ summary: 'Coste y conversión por campaña, separando quién paga el descuento' })
  metricas(): Promise<MetricasCampana[]> {
    return this.campanasService.metricas();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una campaña' })
  crear(@Body() dto: GuardarCampanaDto, @Req() req: RequestConUsuario): Promise<CampanaDocument> {
    return this.campanasService.crear(
      { ...dto, desde: new Date(dto.desde), hasta: new Date(dto.hasta) } as never,
      req.user.sub,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar o desactivar una campaña' })
  actualizar(@Param('id') id: string, @Body() dto: GuardarCampanaDto): Promise<CampanaDocument> {
    return this.campanasService.actualizar(id, {
      ...dto,
      desde: new Date(dto.desde),
      hasta: new Date(dto.hasta),
    } as never);
  }
}
