import { ArrayMinSize, IsArray, IsInt, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

/** Un escalón de la escalera Doogking Alpha, tal y como lo consume el frontend. */
export interface AlphaNivelDto {
  nivel: number;
  nombre: string;
  reservasRequeridas: number;
  descuentoPct: number;
  beneficios: string[];
}

/** Nivel Alpha actual de un usuario y su progreso hacia el siguiente escalón. */
export interface AlphaEstadoDto {
  nivelActual: number;
  nombreNivel: string;
  descuentoPct: number;
  beneficios: string[];
  reservasCompletadas: number;
  /** `null` cuando ya está en el nivel máximo. */
  reservasParaSiguiente: number | null;
  siguienteNivel: AlphaNivelDto | null;
  esMaximoNivel: boolean;
}

export class ActualizarAlphaNivelDto {
  @IsInt()
  @Min(1)
  nivel!: number;

  @IsString()
  @MinLength(1)
  nombre!: string;

  @IsInt()
  @Min(0)
  reservasRequeridas!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  descuentoPct!: number;

  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  beneficios!: string[];
}
