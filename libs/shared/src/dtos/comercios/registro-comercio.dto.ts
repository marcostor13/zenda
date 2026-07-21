import { IsString, IsEmail, MinLength, IsOptional, IsArray, ArrayUnique, IsEnum } from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

/** Alta de comercio en un solo paso: crea la cuenta (comercio_admin) y el negocio. */
export class RegistroComercioDto {
  @IsString()
  nombre!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  /** Razón social: opcional al registrarse; si falta se usa el nombre comercial. */
  @IsOptional()
  @IsString()
  razonSocial?: string;

  /** Identificador fiscal (NIF/VAT en Europa). Opcional: se completa en el panel antes de cobrar. */
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsString()
  nombreComercial!: string;

  /** Ciudad principal del negocio, capturada en el alta para el buscador. */
  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(VerticalKey, { each: true })
  verticales?: VerticalKey[];
}
