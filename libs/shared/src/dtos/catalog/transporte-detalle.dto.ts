import { IsString, IsOptional, IsArray, IsIn, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransporteDetalleDto {
  @IsOptional()
  @IsIn(['van_acondicionada', 'coche', 'furgon_climatizado'])
  tipoVehiculo?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  capacidadPerros?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zonaCobertura?: string[];

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tarifaBase!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tarifaKm!: number;

  @IsOptional()
  @IsBoolean()
  jaulasIncluidas?: boolean;

  @IsOptional()
  @IsBoolean()
  acompananteHumano?: boolean;

  @IsOptional()
  @IsBoolean()
  soloPerros?: boolean;
}
