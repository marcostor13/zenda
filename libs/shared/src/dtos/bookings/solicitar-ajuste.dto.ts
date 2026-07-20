import { IsArray, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SuplementoSeleccionadoDto {
  @IsString()
  @MinLength(1)
  concepto!: string;

  @IsNumber()
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

/** El comercio solicita un ajuste de precio en recepción (docs/mejora_servicios.md §7). */
export class SolicitarAjusteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuplementoSeleccionadoDto)
  suplementos!: SuplementoSeleccionadoDto[];

  @IsOptional()
  @IsString()
  evidenciaUrl?: string;
}
