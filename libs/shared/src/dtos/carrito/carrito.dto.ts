import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, Min,
} from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

/** Añade un servicio al viaje. No bloquea plaza: eso ocurre en el checkout. */
export class AnadirItemCarritoDto {
  @IsString()
  servicioId!: string;

  /**
   * Opcional: si no llega, el backend lo deduce del propio servicio. No debe
   * fiarse del cliente para saber a qué comercio pertenece un servicio.
   */
  @IsOptional()
  @IsString()
  comercioId?: string;

  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsDateString()
  fechaInicio!: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  perroIds?: string[];

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  /** Marca este servicio como el eje del viaje (normalmente el alojamiento). */
  @IsOptional()
  @IsBoolean()
  esReservaMadre?: boolean;
}

/** Resultado de revalidar el carrito antes de cobrar (HU-036). */
export interface ValidacionCarritoDto {
  todoDisponible: boolean;
  items: Array<{
    itemId: string;
    titulo: string;
    disponible: boolean;
    motivo?: string;
  }>;
}
