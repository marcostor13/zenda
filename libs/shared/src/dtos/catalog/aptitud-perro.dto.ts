import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { TamanoPerro, TipoPelo } from '../../enums/perro.enum';

/**
 * Requisitos de aptitud que un comercio declara para un servicio (motor de
 * compatibilidad servicio↔perro, docs/mejora_servicios.md §7). Un array
 * vacío/ausente significa "sin restricción" en ese eje.
 */
export class AptitudPerroDto {
  @IsOptional()
  @IsArray()
  @IsEnum(TamanoPerro, { each: true })
  tamanosAdmitidos?: TamanoPerro[];

  @IsOptional()
  @IsArray()
  @IsEnum(TipoPelo, { each: true })
  tipoPeloAdmitido?: TipoPelo[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  temperamentosNoAdmitidos?: string[];
}
