import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

/** Nota que un profesional deja en la ficha del perro tras completar un servicio. */
export class CrearPerroHistorialDto {
  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsOptional()
  @IsString()
  reservaId?: string;

  @IsString()
  @MinLength(1)
  nota!: string;

  @IsOptional()
  @IsObject()
  datosEstructurados?: Record<string, unknown>;
}
