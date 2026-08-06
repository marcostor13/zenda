import { IsBoolean } from 'class-validator';

/**
 * Alta o baja del comercio en el programa Doogking Alpha (HU-13.3). El descuento
 * concreto no viaja aquí: sale de la escalera de niveles que configura el admin
 * en `alpha_niveles`, para que cambiarla no obligue a reeditar cada comercio.
 */
export class FijarAlphaAdheridoDto {
  @IsBoolean()
  alphaAdherido!: boolean;
}
