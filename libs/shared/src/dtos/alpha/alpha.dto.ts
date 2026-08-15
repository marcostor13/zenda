import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

/** Un escalón de la escalera Doogking Alpha, tal y como lo consume el frontend. */
export interface AlphaNivelDto {
  nivel: number;
  nombre: string;
  reservasRequeridas: number;
  descuentoPct: number;
  beneficios: string[];
  /** Tope en euros del descuento de este nivel. `null` = sin límite. */
  descuentoMaximoEur?: number | null;
  /** Categorías donde aplica el descuento. Lista vacía = todas. */
  verticalesAplicables?: VerticalKey[];
  /** Vigencia del nivel; `null` en cualquiera de los dos extremos = sin límite. */
  vigenciaDesde?: string | null;
  vigenciaHasta?: string | null;
}

/** Nivel Alpha actual de un usuario y su progreso hacia el siguiente escalón. */
export interface AlphaEstadoDto {
  nivelActual: number;
  nombreNivel: string;
  descuentoPct: number;
  beneficios: string[];
  descuentoMaximoEur?: number | null;
  verticalesAplicables?: VerticalKey[];
  vigenciaHasta?: string | null;
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoMaximoEur?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  verticalesAplicables?: VerticalKey[];

  @IsOptional()
  @IsDateString()
  vigenciaDesde?: string | null;

  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string | null;
}
