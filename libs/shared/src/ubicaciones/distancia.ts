/** Punto en grados decimales. */
export interface PuntoGeo {
  readonly lat: number;
  readonly lng: number;
}

const RADIO_TIERRA_KM = 6371;

const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

/**
 * Distancia en línea recta (haversine) entre dos puntos, en km.
 *
 * Es la de «a 2,3 km del centro»: se compara con lo que el usuario ve en el
 * mapa, no con la ruta por carretera.
 */
export function distanciaKm(a: PuntoGeo, b: PuntoGeo): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
