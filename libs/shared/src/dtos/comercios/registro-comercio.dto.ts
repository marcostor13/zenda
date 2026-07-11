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

  @IsString()
  razonSocial!: string;

  /** Identificador fiscal (NIF/VAT en Europa). */
  @IsString()
  vatNumber!: string;

  @IsString()
  nombreComercial!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(VerticalKey, { each: true })
  verticales?: VerticalKey[];
}
