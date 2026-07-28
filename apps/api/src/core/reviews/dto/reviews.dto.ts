import { ArrayMaxSize, IsArray, IsInt, IsMongoId, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CrearReviewDto {
  @IsMongoId()
  reservaId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  puntuacion!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  comentario!: string;

  /** Valoración por criterio (limpieza, trato...), varía por vertical — ver `resena-aspectos.config.ts` en el front. */
  @IsOptional()
  @IsObject()
  aspectos?: Record<string, number>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(6)
  fotos?: string[];
}

export class ActualizarReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  puntuacion?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  comentario?: string;

  @IsOptional()
  @IsObject()
  aspectos?: Record<string, number>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(6)
  fotos?: string[];
}

export class ResponderReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  respuesta!: string;
}
