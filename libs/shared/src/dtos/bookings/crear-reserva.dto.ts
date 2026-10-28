import {
  IsString, IsOptional, IsInt, IsDateString, Min, IsEnum, IsObject, ValidateNested, IsArray, ArrayMaxSize,
  IsNotEmpty, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VerticalKey } from '../../enums/vertical.enum';
import { RecurrenciaDto } from './recurrencia.dto';

/** Contacto de quien reserva sin cuenta. El email no viaja: es el de su sesión. */
export class ContactoReservaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}

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

  /**
   * Más mascotas del mismo cliente en la misma reserva (un traslado lleva a
   * varias a la vez). La primera sigue yendo en `perroId`; estas se validan
   * igual —tienen que ser suyas— y su ficha se congela junto a la principal.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  perroIdsAdicionales?: string[];

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

  /**
   * Sólo para reservas de invitado: a quién atender y a qué teléfono llamar.
   * Con cuenta se ignora, porque esos datos ya están en el perfil.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactoReservaDto)
  contacto?: ContactoReservaDto;
}
