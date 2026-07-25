import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoHistorial } from '../../enums/historial.enum';
import { VerticalKey } from '../../enums/vertical.enum';

/** Concede o revoca que un vertical vea un tipo de historial de la mascota. */
export class FijarConsentimientoDto {
  @IsEnum(TipoHistorial)
  tipoHistorial!: TipoHistorial;

  @IsEnum(VerticalKey)
  verticalDestino!: VerticalKey;

  @IsBoolean()
  concedido!: boolean;
}

/** Una fila del historial pegado desde Excel o un documento (HU-032). */
export class FilaHistorialDto {
  @IsOptional()
  @IsString()
  fecha?: string;

  @IsString()
  concepto!: string;

  @IsOptional()
  @IsString()
  detalle?: string;
}

/** Vista previa: convierte el texto pegado en filas, sin guardar nada. */
export class PrevisualizarImportacionDto {
  @IsString()
  texto!: string;
}

/** Confirmación de la importación, ya revisada por el profesional. */
export class ImportarHistorialDto {
  @IsEnum(VerticalKey)
  vertical!: VerticalKey;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilaHistorialDto)
  filas!: FilaHistorialDto[];
}

/** El propietario corrige el texto de una entrada del historial (HU-015). */
export class EditarHistorialDto {
  @IsString()
  nota!: string;
}
