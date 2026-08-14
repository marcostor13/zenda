import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EstadoIncidencia, TipoIncidencia } from '../../enums/incidencia.enum';

export class CrearIncidenciaDto {
  @IsOptional()
  @IsMongoId()
  reservaId?: string;

  @IsEnum(TipoIncidencia)
  tipo!: TipoIncidencia;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  asunto!: string;

  @IsString()
  @MinLength(10)
  descripcion!: string;
}

/**
 * Cada cambio de estado deja constancia de quién lo hizo y por qué: sin eso, un
 * equipo de varias personas no puede saber qué se ha hecho ya (TCK-8040 §2).
 */
export class ActualizarIncidenciaDto {
  @IsEnum(EstadoIncidencia)
  estado!: EstadoIncidencia;

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsString()
  resolucion?: string;
}
