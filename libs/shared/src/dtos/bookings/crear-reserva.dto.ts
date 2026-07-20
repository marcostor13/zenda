import { IsString, IsOptional, IsInt, IsDateString, Min, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VerticalKey } from '../../enums/vertical.enum';
import { RecurrenciaDto } from './recurrencia.dto';

export class CrearReservaDto {
  @IsString()
  servicioId!: string;

  @IsString()
  comercioId!: string;

  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsOptional()
  @IsString()
  perroId?: string;

  @IsDateString()
  fechaInicio!: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsObject()
  detalle?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  cuponCodigo?: string;

  /** Patrón simple de recurrencia (docs §4.3): genera reservas hijas para cada ocurrencia. */
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenciaDto)
  recurrencia?: RecurrenciaDto;
}
