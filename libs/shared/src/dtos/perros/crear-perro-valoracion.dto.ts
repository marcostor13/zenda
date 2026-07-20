import { IsInt, IsMongoId, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** El comercio valora al perro tras completar una reserva (reputación bidireccional). */
export class CrearPerroValoracionDto {
  @IsMongoId()
  reservaId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  puntuacion!: number;

  @IsOptional()
  @IsObject()
  atributos?: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}
