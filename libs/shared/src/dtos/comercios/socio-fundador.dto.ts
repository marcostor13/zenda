import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Alta o baja en el programa Socios Fundadores (HU-047). Al dar de alta se
 * congela la comisión durante `mesesCongelacion`; al dar de baja se libera y el
 * comercio vuelve a la tarifa vigente.
 */
export class FijarSocioFundadorDto {
  @IsBoolean()
  socioFundador!: boolean;

  /** Comisión congelada como fracción (0.10 = 10 %). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  comisionPctCongelada?: number;

  /** Duración del compromiso; por defecto 24 meses. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  mesesCongelacion?: number;

  /** Cohorte de captación (`2026-Q3`), dimensión del reporte financiero. */
  @IsOptional()
  @IsString()
  cohorte?: string;
}
