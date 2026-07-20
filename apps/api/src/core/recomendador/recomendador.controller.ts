import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RecomendadorService } from './recomendador.service';
import {
  RecomendarAdiestramientoDto,
  RecomendacionAdiestramientoDto,
  RecomendarVeterinariaDto,
  RecomendacionVeterinariaDto,
} from 'shared';

@ApiTags('recomendador')
@Controller('recomendador')
export class RecomendadorController {
  constructor(private readonly recomendadorService: RecomendadorService) {}

  @Post('adiestramiento')
  @ApiOperation({ summary: 'Recomienda el tipo de servicio de adiestramiento según motivo/intensidad' })
  adiestramiento(@Body() dto: RecomendarAdiestramientoDto): RecomendacionAdiestramientoDto {
    return this.recomendadorService.recomendarAdiestramiento(dto);
  }

  @Post('veterinaria')
  @ApiOperation({ summary: 'Triaje: recomienda la acción según motivo/gravedad de los síntomas' })
  veterinaria(@Body() dto: RecomendarVeterinariaDto): RecomendacionVeterinariaDto {
    return this.recomendadorService.recomendarVeterinaria(dto);
  }
}
