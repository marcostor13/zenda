import { IsString, IsOptional, IsInt, IsDateString, Min, IsEnum, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VerticalKey } from '../../enums/vertical.enum';
import { RecurrenciaDto } from './recurrencia.dto';

export class CrearReservaDto {
  @IsString()
  servicioId!: string;

  /**
   * @deprecated El comercio se deduce del servicio. Se sigue aceptando por
   * compatibilidad, y si no coincide con el del servicio la reserva se rechaza
   * con 409 en vez de atribuirse a quien diga el cliente.
   */
  @IsOptional()
  @IsString()
  comercioId?: string;

  /** @deprecated Igual que `comercioId`: manda el vertical del servicio. */
  @IsOptional()
  @IsEnum(VerticalKey)
  vertical?: VerticalKey;

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
