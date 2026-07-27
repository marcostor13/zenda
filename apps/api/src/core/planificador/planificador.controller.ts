import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PlanificadorService, RespuestaItinerario } from './planificador.service';

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
  @IsString({ each: true })
  intereses?: string[];
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

  @Post('itinerario')
  @ApiOperation({ summary: 'Generar un itinerario de viaje con mascota para una provincia' })
  generar(
    @Body() dto: GenerarItinerarioDto,
    @Req() req: RequestConUsuario,
  ): Promise<RespuestaItinerario> {
    return this.planificadorService.generar(dto, req.user?.sub);
  }
}
