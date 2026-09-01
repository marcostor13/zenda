/**
 * Lecturas del catálogo funerario que comparten listado, ficha y reserva.
 *
 * Los tres leen el mismo `extra` que devuelve el API y necesitan lo mismo: qué
 * servicios están activos y cuál es el más barato. Vive aquí para que no haya
 * tres copias del mismo `as Array<…>` repartidas por la app.
 */

/** Servicio del catálogo tal y como viaja en `extra` (shape del API). */
export interface ServicioFunerarioPublico {
  nombre: string;
  tipo: string;
  descripcion?: string;
  incluye?: string[];
  precioBase: number;
  tramosPeso?: Array<{ hastaKg: number; precio: number }>;
  tiempoEstimadoHoras?: number;
  devuelveCenizas: boolean;
  urnaIncluida: boolean;
  certificadoIncluido: boolean;
  activo: boolean;
}

/** Extra opcional (urna, huella, ceremonia…) que el cliente puede añadir. */
export interface ExtraFunerarioPublico {
  nombre: string;
  precio: number;
  descripcion?: string;
  activo: boolean;
}

/** Servicios que la empresa tiene publicados y activos, en orden de catálogo. */
export function serviciosFunerarios(extra: Record<string, unknown>): ServicioFunerarioPublico[] {
  const lista = (extra['serviciosFunerarios'] as ServicioFunerarioPublico[] | undefined) ?? [];
  return lista.filter((s) => s.activo !== false);
}

/** Extras activos de la empresa. */
export function extrasFunerarios(extra: Record<string, unknown>): ExtraFunerarioPublico[] {
  const lista = (extra['extras'] as ExtraFunerarioPublico[] | undefined) ?? [];
  return lista.filter((e) => e.activo !== false);
}

/**
 * Precio más bajo del catálogo, contando los tramos de peso: es el "desde" que
 * se enseña en la tarjeta. Devuelve `undefined` si la empresa aún no ha puesto
 * precio a nada, para que la vista caiga a su valor por defecto.
 */
export function precioDesdeFunerario(servicio: { extra: Record<string, unknown> }): number | undefined {
  const precios = serviciosFunerarios(servicio.extra).flatMap((s) => [
    ...(s.tramosPeso ?? []).map((t) => t.precio),
    s.precioBase,
  ]).filter((p): p is number => typeof p === 'number' && p > 0);

  return precios.length ? Math.min(...precios) : undefined;
}
