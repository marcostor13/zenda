import { IsString, IsNumber, IsOptional, IsIn, IsBoolean, IsEnum, Min, IsDateString } from 'class-validator';
import { AsumeDescuento } from '../../enums/evento.enum';

export class ValidarCuponDto {
  @IsString()
  codigo!: string;

  @IsString()
  vertical!: string;

  @IsNumber()
  @Min(0)
  montoSubtotal!: number;
}

export class CrearCuponDto {
  @IsString()
  codigo!: string;

  @IsIn(['porcentaje', 'fijo'])
  tipo!: 'porcentaje' | 'fijo';

  @IsNumber()
  @Min(0)
  valor!: number;

  @IsOptional()
  @IsString()
  vertical?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montoMinimo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  topeDescuento?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usoMaximo?: number;

  @IsOptional()
  @IsDateString()
  validoHasta?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;

  /**
   * Quién paga el descuento: cambia el margen real de la reserva, así que no
   * puede quedar implícito (TCK-8037 §7).
   */
  @IsOptional()
  @IsEnum(AsumeDescuento)
  asumeDescuento?: AsumeDescuento;

  /** Restringe el cupón a quien todavía no ha reservado (TCK-8037 §4). */
  @IsOptional()
  @IsBoolean()
  soloPrimeraReserva?: boolean;

  /** Usos por persona; 0 = sin límite individual (TCK-8037 §6). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  usosPorUsuario?: number;

  /** Alcance: un comercio concreto o una ciudad (TCK-8037 §5). */
  @IsOptional()
  @IsString()
  comercioId?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  /** Nivel Alpha mínimo para poder usarlo; 0 = cualquiera (TCK-8037 §4). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  nivelAlphaMinimo?: number;
}
