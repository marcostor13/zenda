import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AiSearchService } from './ai-search.service';

class AiSearchDto {
  @IsString()
  query!: string;
}

/**
 * Cada llamada consume tokens de DeepSeek facturados a la plataforma, y el
 * endpoint es público porque el buscador de la portada se usa sin sesión. El
 * límite es el techo del gasto: 5 búsquedas por minuto y por IP cubren de sobra
 * a una persona escribiendo y cierran la puerta a que un tercero nos facture.
 */
@ApiTags('ai-search')
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Controller('ai-search')
export class AiSearchController {
  constructor(private readonly aiSearch: AiSearchService) {}

  @Post()
  @ApiOperation({ summary: 'Interpreta una búsqueda en lenguaje natural y devuelve parámetros estructurados' })
  search(@Body() dto: AiSearchDto) {
    return this.aiSearch.interpretSearch(dto.query);
  }
}
