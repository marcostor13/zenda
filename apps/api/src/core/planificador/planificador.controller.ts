import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import {
  ArrayMaxSize, IsArray, IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min,
  MinLength,
} from 'class-validator';
import { AlojamientoViaje, DesplazamientoViaje, RitmoViaje, SERVICIOS_EXTRA_VIAJE } from 'shared';
import { DestinoPlanificador, PlanificadorService, RespuestaItinerario } from './planificador.service';

interface RequestConUsuario extends Request {
  user?: { sub: string };
}

class GenerarItinerarioDto {
  /** Provincia o cualquier población, escrita libremente. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  destino?: string;

  /** Compatibilidad con la tarjeta de provincia; el servicio exige uno de los dos. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  provincia?: string;

  /** Obligatorias: el servicio comprueba además que no sean pasadas ni estén al revés. */
  @IsDateString({}, { message: 'Indica la fecha de ida del viaje' })
  desde!: string;

  @IsDateString({}, { message: 'Indica la fecha de vuelta del viaje' })
  hasta!: string;

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
  @MaxLength(80)
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
  @IsIn([...SERVICIOS_EXTRA_VIAJE], { each: true })
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
  @ApiOperation({ summary: 'Generar un itinerario de viaje con mascota para un destino (provincia o población)' })
  generar(
    @Body() dto: GenerarItinerarioDto,
    @Req() req: RequestConUsuario,
  ): Promise<RespuestaItinerario> {
    return this.planificadorService.generar(dto, req.user?.sub);
  }
}
