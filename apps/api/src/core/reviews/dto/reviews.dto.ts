import { IsInt, IsMongoId, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
}

export class ResponderReviewDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  respuesta!: string;
}
