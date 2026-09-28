import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min, MinLength,
} from 'class-validator';
import { AlojamientoViaje, DesplazamientoViaje, RitmoViaje, VerticalKey } from 'shared';
import { DestinoPlanificador, PlanificadorService, RespuestaItinerario } from './planificador.service';

interface RequestConUsuario extends Request {
  user?: { sub: string };
}

class GenerarItinerarioDto {
  @IsString()
  @MinLength(2)
  provincia!: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsString()
  perroId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  presupuestoMax?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  intereses?: string[];

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsEnum(RitmoViaje)
  ritmo?: RitmoViaje;

  @IsOptional()
  @IsEnum(AlojamientoViaje)
  alojamiento?: AlojamientoViaje;

  @IsOptional()
  @IsEnum(DesplazamientoViaje)
  desplazamiento?: DesplazamientoViaje;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsIn(Object.values(VerticalKey), { each: true })
  serviciosExtra?: string[];
}

/**
 * Planificador de viajes. **Público a propósito**: es contenido de
 * descubrimiento, y exigir cuenta antes de enseñar el plan perdería justo a
 * quien todavía no la tiene. El tope de uso solo se aplica a quien va
 * identificado; para el resto rige la caché.
 */
@ApiTags('planificador')
@Controller('planificador')
export class PlanificadorController {
  constructor(private readonly planificadorService: PlanificadorService) {}

  @Get('destinos')
  @ApiOperation({ summary: 'Provincias con lugares o servicios publicados para planificar un viaje' })
  destinos(): Promise<DestinoPlanificador[]> {
    return this.planificadorService.destinos();
  }

  @Post('itinerario')
  @ApiOperation({ summary: 'Generar un itinerario de viaje con mascota para una provincia' })
  generar(
    @Body() dto: GenerarItinerarioDto,
    @Req() req: RequestConUsuario,
  ): Promise<RespuestaItinerario> {
    return this.planificadorService.generar(dto, req.user?.sub);
  }
}
