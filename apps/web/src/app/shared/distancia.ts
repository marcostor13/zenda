/**
 * Distancia para leer de un vistazo: "8,4 km" cerca, "23 km" lejos. Con coma,
 * como se escribe en España; los decimales sólo importan cuando está a mano.
 */
export function kmLegibles(km: number): string {
  const redondeado = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${String(redondeado).replace('.', ',')} km`;
}

/** Subtítulo de una tarjeta: la población y, si viene de "lo más cercano", a cuánto está. */
export function lugarConDistancia(ciudad: string, distanciaKm?: number): string {
  return distanciaKm == null ? ciudad : `${ciudad} · a ${kmLegibles(distanciaKm)}`;
}
