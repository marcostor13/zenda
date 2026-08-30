import {
  IsString, IsEnum, IsNumber, IsOptional, IsArray, IsObject, IsLatitude, IsLongitude,
  Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VerticalKey } from '../../enums/vertical.enum';
import { AptitudPerroDto } from './aptitud-perro.dto';
import { ExcepcionHorarioDto, HorarioDiaDto } from '../comunes/horario.dto';

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


  /**
   * Dirección exacta del servicio. Vive aquí y no en el comercio: un mismo
   * negocio puede tener la residencia canina a las afueras y la peluquería en el
   * centro, y con una única dirección de empresa el cliente veía en la ficha un
   * sitio al que no tenía que ir.
   */
  @IsOptional()
  @IsString()
  calle?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  codigoPostal?: string;

  @IsOptional()
  @IsString()
  pais?: string;

  /** Horario de atención de este servicio, día a día. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioDiaDto)
  horario?: HorarioDiaDto[];

  /** Festivos, vacaciones y cierres puntuales; mandan sobre el horario semanal. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcepcionHorarioDto)
  excepcionesHorario?: ExcepcionHorarioDto[];

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
