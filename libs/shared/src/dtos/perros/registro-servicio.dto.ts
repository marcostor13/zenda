import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsEnum, IsInt, IsMongoId, IsObject, IsOptional, IsString,
  IsUrl, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

/** Tope de adjuntos por registro: un informe, un analítico y poco más. */
export const MAX_ADJUNTOS_REGISTRO = 6;

/**
 * Fichero que el comercio adjunta a un registro del historial (el analítico en
 * PDF, el informe en Word, la foto de la herida).
 *
 * Sólo se guarda la referencia: el fichero ya se subió por `POST
 * /upload/documento`, que es quien decide por el contenido si el formato vale.
 */
export class AdjuntoRegistroDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre!: string;

  // `require_tld: false` porque en desarrollo el API se sirve desde `localhost`.
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(600)
  url!: string;

  /** Tipo real que devolvió la subida; gobierna el icono y si se puede ver. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tipo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50 * 1024 * 1024)
  tamano?: number;
}

/** El comercio anota en la ficha del perro lo que hizo en un servicio. */
export class CrearRegistroServicioDto {
  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsOptional()
  @IsMongoId()
  reservaId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(140)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  nota?: string;

  @IsOptional()
  @IsDateString()
  fechaServicio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  profesional?: string;

  @IsOptional()
  @IsDateString()
  proximaCita?: string;

  @IsOptional()
  @IsObject()
  datosEstructurados?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ADJUNTOS_REGISTRO)
  @ValidateNested({ each: true })
  @Type(() => AdjuntoRegistroDto)
  adjuntos?: AdjuntoRegistroDto[];
}

/** Corrección de un registro propio: la categoría y la reserva no cambian. */
export class ActualizarRegistroServicioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  nota?: string;

  @IsOptional()
  @IsDateString()
  fechaServicio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  profesional?: string;

  @IsOptional()
  @IsDateString()
  proximaCita?: string;

  @IsOptional()
  @IsObject()
  datosEstructurados?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ADJUNTOS_REGISTRO)
  @ValidateNested({ each: true })
  @Type(() => AdjuntoRegistroDto)
  adjuntos?: AdjuntoRegistroDto[];
}
