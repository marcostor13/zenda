/**
 * Búsqueda por población sin resultados: lo que hay cerca, como hace Booking.
 * Quien busca en Castellón y no hay ningún servicio ve "el más cercano está en
 * Vila-real, a 8 km" en lugar de un listado vacío.
 */

/** Hasta dónde se busca alrededor de la población pedida. */
export const RADIO_CERCANOS_KM = 60;

export interface ServicioCercanoApi {
  id: string;
  nombre: string;
  ciudad: string;
  distanciaKm: number;
}

export interface BusquedaCercanosApi {
  /** La población tal y como la escribe la plataforma ("Castellón de la Plana"). */
  ciudadBuscada: string;
  radioKm: number;
  masCercano: ServicioCercanoApi;
}
