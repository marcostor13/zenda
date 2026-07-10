import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ServicioClinicoDto {
  @IsString()
  nombre!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precio!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  duracionMin?: number;
}

export class VeterinariaDetalleDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  especialidades?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicioClinicoDto)
  serviciosClinicos!: ServicioClinicoDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  duracionCitaMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  citasPorDia?: number;

  @IsOptional()
  @IsBoolean()
  atiendeUrgencias?: boolean;

  @IsOptional()
  @IsString()
  horario?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precioConsulta!: number;
}
