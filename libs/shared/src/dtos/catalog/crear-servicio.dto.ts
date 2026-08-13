import {
  IsString, IsEnum, IsNumber, IsOptional, IsArray, IsObject, IsLatitude, IsLongitude,
  Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VerticalKey } from '../../enums/vertical.enum';
import { AptitudPerroDto } from './aptitud-perro.dto';

export class CrearServicioDto {
  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsString()
  titulo!: string;

  @IsString()
  descripcion!: string;

  @IsString()
  ciudad!: string;

  /**
   * Coordenadas del listado. Opcionales: no todas las poblaciones se eligen
   * desde el autocompletado, y un servicio sin ellas debe poder publicarse
   * igualmente — simplemente no saldrá en la búsqueda por mapa.
   */
  @IsOptional()
  @IsLatitude()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsLongitude()
  @Type(() => Number)
  lng?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precioBase!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenes?: string[];

  /**
   * Campos propios del vertical elegido (espacios, tarifas, servicios
   * clínicos/grooming, cupos…). CatalogService filtra por una whitelist
   * según `vertical`; el resto se descarta.
   */
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;

  /** Para qué perfiles de perro es apto este servicio (motor de compatibilidad, Fase B). */
  @IsOptional()
  @ValidateNested()
  @Type(() => AptitudPerroDto)
  aptitud?: AptitudPerroDto;
}
