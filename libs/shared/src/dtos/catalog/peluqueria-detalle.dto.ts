import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ServicioGroomingDto {
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

  @IsOptional()
  @IsString()
  tamanoPerro?: string;
}

export class PeluqueriaDetalleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicioGroomingDto)
  serviciosGrooming!: ServicioGroomingDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  duracionSlotMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  capacidadSimultanea?: number;

  @IsOptional()
  @IsBoolean()
  aDomicilio?: boolean;

  @IsOptional()
  @IsString()
  horario?: string;
}
