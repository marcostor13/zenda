/**
 * Distancia para leer de un vistazo: "8,4 km" cerca, "23 km" lejos. Con coma,
 * como se escribe en España; los decimales sólo importan cuando está a mano.
 */
export function kmLegibles(km: number): string {
  const redondeado = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${String(redondeado).replace('.', ',')} km`;
}

/** Traductor con marcas `{km}`; por defecto sólo interpola, en español. */
export type TraducirDistancia = (texto: string, params: Readonly<Record<string, string>>) => string;

const sinTraducir: TraducirDistancia = (texto, params) =>
  texto.replace(/\{(\w+)\}/g, (_, clave: string) => params[clave] ?? '');

/**
 * Subtítulo de una tarjeta: la población y, al lado, a cuánto está.
 *
 * - Si viene de «lo más cercano», la distancia a la población buscada manda:
 *   es la que responde a lo que se ha pedido.
 * - Si no, la distancia al centro de su población («a 2,3 km del centro»),
 *   como en Booking (observación del cliente 28-09).
 */
export function lugarConDistancia(
  ciudad: string,
  distanciaKm?: number,
  distanciaCentroKm?: number,
  traducir: TraducirDistancia = sinTraducir,
): string {
  if (distanciaKm != null) return `${ciudad} · ${traducir('a {km}', { km: kmLegibles(distanciaKm) })}`;
  if (distanciaCentroKm != null) {
    return `${ciudad} · ${traducir('a {km} del centro', { km: kmLegibles(distanciaCentroKm) })}`;
  }
  return ciudad;
}
