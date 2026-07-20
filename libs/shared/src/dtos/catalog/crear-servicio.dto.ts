import { IsString, IsEnum, IsNumber, IsOptional, IsArray, IsObject, Min, ValidateNested } from 'class-validator';
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
