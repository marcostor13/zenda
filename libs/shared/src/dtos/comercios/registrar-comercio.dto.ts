import { IsString, IsOptional, IsArray, IsEnum, ArrayUnique } from 'class-validator';
import { VerticalKey } from '../../enums/vertical.enum';

export class RegistrarComercioDto {
  @IsString()
  razonSocial!: string;

  /** Identificador fiscal (NIF/VAT en Europa). */
  @IsString()
  vatNumber!: string;

  @IsString()
  nombreComercial!: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(VerticalKey, { each: true })
  verticales?: VerticalKey[];
}
