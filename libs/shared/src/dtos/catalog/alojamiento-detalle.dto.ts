import { IsString, IsOptional, IsArray, IsIn, IsNumber, IsBoolean, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EspacioCaninoDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsIn(['suite', 'estandar', 'compartido'])
  tipo!: string;

  @IsIn(['pequeno', 'mediano', 'grande', 'gigante'])
  tamanoMaxPerro!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precioNoche!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  precioAnterior?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenes?: string[];

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  cantidad!: number;

  @IsOptional()
  @IsBoolean()
  disponible?: boolean;

  @IsOptional()
  @IsBoolean()
  cancelacionGratis?: boolean;
}

export class AlojamientoDetalleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EspacioCaninoDto)
  espacios!: EspacioCaninoDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  checkIn?: string;

  @IsOptional()
  @IsString()
  checkOut?: string;

  @IsOptional()
  @IsIn(['flexible', 'moderada', 'estricta'])
  politicaCancelacion?: string;

  @IsOptional()
  @IsBoolean()
  requisitoVacunas?: boolean;

  @IsOptional()
  @IsBoolean()
  paseosIncluidos?: boolean;

  @IsOptional()
  @IsBoolean()
  camaras24h?: boolean;

  @IsOptional()
  @IsBoolean()
  cancelacionGratis?: boolean;

  @IsOptional()
  @IsString()
  barrio?: string;

  @IsOptional()
  @IsString()
  direccion?: string;
}
