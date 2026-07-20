import { IsString, IsNumber, IsOptional, IsArray, IsObject, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AptitudPerroDto } from './aptitud-perro.dto';

/** El vertical de un servicio no se puede cambiar tras su creación. */
export class ActualizarServicioDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precioBase?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenes?: string[];

  /** Campos propios del vertical (mismo formato que en CrearServicioDto.extra). */
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => AptitudPerroDto)
  aptitud?: AptitudPerroDto;
}
