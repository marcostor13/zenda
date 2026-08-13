import {
  IsString, IsNumber, IsOptional, IsArray, IsObject, IsLatitude, IsLongitude,
  Min, ValidateNested,
} from 'class-validator';
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

  /** Coordenadas del listado; sin ellas el servicio no sale en la búsqueda por mapa. */
  @IsOptional()
  @IsLatitude()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsLongitude()
  @Type(() => Number)
  lng?: number;

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
