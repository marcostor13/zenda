import {
  IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, Max, Min, MinLength,
} from 'class-validator';
import { EstadoModeracion, TipoLugar } from '../../enums/lugar.enum';

export class CrearLugarDto {
  @IsEnum(TipoLugar)
  tipo!: TipoLugar;

  @IsString()
  @MinLength(2)
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotos?: string[];

  @IsString()
  @MinLength(2)
  ciudad!: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsObject()
  atributos?: Record<string, unknown>;
}

export class ActualizarLugarDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotos?: string[];

  @IsOptional()
  @IsObject()
  atributos?: Record<string, unknown>;
}

export class CrearLugarReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  puntuacion!: number;

  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotos?: string[];

  @IsOptional()
  @IsBoolean()
  esIncidencia?: boolean;
}

/** Decisión de moderación del administrador sobre un lugar o una aportación. */
export class ModerarDto {
  @IsEnum(EstadoModeracion)
  estado!: EstadoModeracion;

  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}
