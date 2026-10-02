import { precioDesdeServicio } from 'shared';

/** Lo que trae cualquier tarjeta o ficha del catálogo para saber su precio. */
export interface ConPrecioDeCatalogo {
  readonly precioPorNoche: number;
  readonly extra?: Readonly<Record<string, unknown>>;
}

/**
 * Precio «desde» de un servicio de la categoría, con la misma regla que el API
 * (`precioDesdeServicio` de `shared`): el listado, la ficha y el panel de
 * reserva tienen que enseñar el mismo número. Antes cada configuración leía un
 * campo distinto —`precioConsulta` aquí, `precioBase` allá— y la tarjeta y la
 * ficha no coincidían.
 */
export const precioDesde = (vertical: string) =>
  (servicio: ConPrecioDeCatalogo): number =>
    precioDesdeServicio({ vertical, precioBase: servicio.precioPorNoche, extra: servicio.extra });
