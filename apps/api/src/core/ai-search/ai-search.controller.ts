import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AiSearchService } from './ai-search.service';

class AiSearchDto {
  @IsString()
  query!: string;
}

@ApiTags('ai-search')
@Controller('ai-search')
export class AiSearchController {
  constructor(private readonly aiSearch: AiSearchService) {}

  @Post()
  @ApiOperation({ summary: 'Interpreta una búsqueda en lenguaje natural y devuelve parámetros estructurados' })
  search(@Body() dto: AiSearchDto) {
    return this.aiSearch.interpretSearch(dto.query);
  }
}
