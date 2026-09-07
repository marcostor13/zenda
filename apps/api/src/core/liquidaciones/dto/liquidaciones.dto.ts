import { IsDateString, IsMongoId, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * El controlador recibía interfaces sueltas, así que el `ValidationPipe` global
 * no tenía metadatos y **no validaba nada**: un `comercioId` cualquiera o una
 * fecha sin sentido llegaban al servicio, y allí `new Date('lo que sea')` se
 * convertía en `Invalid Date`, que no casa ningún pago y acababa devolviendo
 * "No hay pagos cobrados en el periodo" —un mensaje que manda a mirar donde no
 * está el problema.
 */
export class GenerarLiquidacionDto {
  @IsMongoId()
  comercioId!: string;

  /** Fecha ISO (`2026-09-01`); el servicio la extiende al día completo. */
  @IsDateString()
  desde!: string;

  @IsDateString()
  hasta!: string;
}

export class MarcarPagadaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  referencia!: string;
}
