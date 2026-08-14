/**
 * Plazas libres de un servicio, derivadas de la capacidad que declara el comercio.
 *
 * El contador arranca en 0 por defecto en el esquema y el comercio no tiene
 * ningún campo donde escribirlo: declara su capacidad (los espacios de la
 * residencia, las citas por día, los cupos por sesión…) y el contador debía
 * salir de ahí. Como la búsqueda descarta lo que no tiene plazas (P2), un
 * listado con el contador a 0 es invisible en la web por completo y publicado
 * que esté.
 *
 * Vive aquí, y no dentro de un servicio, porque hacen falta en dos momentos que
 * viven en módulos distintos: al guardar el listado (`CatalogService`) y al
 * publicarlo (`ComerciosService`). Con una sola copia de la regla no pueden
 * discrepar.
 */

interface ReglaDisponibilidad {
  /** Campo que cuenta las plazas libres en ese vertical. */
  readonly contador: string;
  /** Campo del que se deduce la capacidad declarada. */
  readonly origen: string;
  /** La capacidad viene troceada en una lista de elementos con `cantidad`. */
  readonly sumaCantidades?: true;
}

/**
 * Añadir un vertical es añadir una entrada aquí; el core no cambia.
 *
 * Transporte y hoteles no aparecen porque su formulario ya pide el
 * contador directamente, así que no hay nada que deducir.
 */
export const CONTADOR_DISPONIBILIDAD: Record<string, ReglaDisponibilidad> = {
  alojamiento:    { contador: 'espaciosDisponibles', origen: 'espacios', sumaCantidades: true },
  veterinaria:    { contador: 'citasDisponibles',    origen: 'citasPorDia' },
  peluqueria:     { contador: 'cuposDisponibles',    origen: 'capacidadSimultanea' },
  adiestramiento: { contador: 'cuposDisponibles',    origen: 'capacidadPorSesion' },
};

/** Nombre del campo contador de un vertical, o `undefined` si no tiene. */
export function campoContador(vertical: string): string | undefined {
  return CONTADOR_DISPONIBILIDAD[vertical]?.contador;
}

/**
 * Plazas que se deducen de la capacidad declarada en `datos`, o `undefined` si
 * el vertical no deduce contador o no hay capacidad declarada. Devolver
 * `undefined` en vez de 0 es intencionado: sin capacidad no se inventa nada y
 * el listado sigue oculto, que es lo correcto — no hay nada que reservar.
 */
export function plazasDeclaradas(vertical: string, datos: Record<string, unknown>): number | undefined {
  const regla = CONTADOR_DISPONIBILIDAD[vertical];
  if (!regla) return undefined;

  const origen = datos[regla.origen];
  const plazas = regla.sumaCantidades
    ? (Array.isArray(origen) ? origen : []).reduce<number>(
        (total, item) => total + (Number((item as { cantidad?: unknown }).cantidad) || 0), 0)
    : Number(origen);

  return Number.isFinite(plazas) && plazas > 0 ? plazas : undefined;
}

/** `true` si ese contador no ofrece plazas (ausente, 0 o valor no numérico). */
export function sinPlazas(valor: unknown): boolean {
  const n = Number(valor);
  return !Number.isFinite(n) || n <= 0;
}
