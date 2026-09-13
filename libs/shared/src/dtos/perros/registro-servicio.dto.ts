import {
  IsDateString, IsEnum, IsMongoId, IsObject, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

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
}
