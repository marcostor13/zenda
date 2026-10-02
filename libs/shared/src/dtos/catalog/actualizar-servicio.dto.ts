import {
  IsString, IsNumber, IsOptional, IsArray, IsObject, IsLatitude, IsLongitude,
  Min, ValidateNested, ValidateIf, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PATRON_CALLE, PATRON_NUMERO_PORTAL } from '../../ubicaciones/formatear-direccion';
import { AptitudPerroDto } from './aptitud-perro.dto';
import { ExcepcionHorarioDto, HorarioDiaDto } from '../comunes/horario.dto';

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


  /**
   * Dirección exacta del servicio. Vive aquí y no en el comercio: un mismo
   * negocio puede tener la residencia canina a las afueras y la peluquería en el
   * centro, y con una única dirección de empresa el cliente veía en la ficha un
   * sitio al que no tenía que ir.
   */
  @IsOptional()
  @IsString()
  // Vacía vale (la dirección exacta es opcional), pero si se escribe tiene que
  // ser una calle: con «1» como calle la ficha pintaba «1, 1, , Valencia».
  @ValidateIf((o: { calle?: string }) => !!o.calle?.trim())
  @Matches(PATRON_CALLE, { message: 'La calle tiene que llevar su nombre, no sólo un número.' })
  calle?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o: { numero?: string }) => !!o.numero?.trim())
  @Matches(PATRON_NUMERO_PORTAL, { message: 'El número del portal no es válido (ej.: 12, 12 B, s/n).' })
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
