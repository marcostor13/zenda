/**
 * Geocodificación para los scripts de mantenimiento: Places (New) con respaldo
 * de Nominatim (OpenStreetMap), el mismo par que usa el mapa del frontend.
 *
 * Los scripts no arrancan Nest, así que no pueden inyectar `GeoService`; esto
 * es lo mínimo para convertir un texto en un punto.
 */

/** GeoJSON: [lng, lat]. */
export type Punto = [number, number];

export type Geocodificador = (consulta: string) => Promise<Punto | null>;

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PAUSA_MS = 120;
/** Nominatim: una consulta por segundo y User-Agent propio, por sus condiciones de uso. */
const PAUSA_OSM_MS = 1_100;
const USER_AGENT = 'Doogking/1.0 (scripts de mantenimiento; contacto: soporte@doogking.com)';

const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Primer resultado de una búsqueda de texto en Places (New). */
async function puntoGoogle(consulta: string, apiKey: string): Promise<Punto | null> {
  try {
    const respuesta = await fetch(PLACES_TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.location',
      },
      body: JSON.stringify({ textQuery: consulta, regionCode: 'es', languageCode: 'es', pageSize: 1 }),
    });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as { places?: Array<{ location?: { latitude?: number; longitude?: number } }> };
    const punto = datos.places?.[0]?.location;
    return punto?.latitude != null && punto.longitude != null ? [punto.longitude, punto.latitude] : null;
  } catch {
    return null;
  }
}

async function puntoOsm(consulta: string): Promise<Punto | null> {
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&countrycodes=es&q=${encodeURIComponent(consulta)}`;
  try {
    const respuesta = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as Array<{ lat?: string; lon?: string }>;
    const primero = datos[0];
    return primero?.lat && primero.lon ? [Number(primero.lon), Number(primero.lat)] : null;
  } catch {
    return null;
  }
}

/**
 * Elige el proveedor una sola vez con una consulta de prueba: si la clave de
 * Google está caducada o sin permisos, insistir en cada fila sólo alarga la
 * espera y deja todo sin punto.
 */
export async function elegirGeocodificador(): Promise<{ buscar: Geocodificador; proveedor: string }> {
  const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
  const usarGoogle = Boolean(apiKey) && (await puntoGoogle('Plaza del Ayuntamiento, València, España', apiKey as string)) !== null;

  const buscar: Geocodificador = async (consulta) => {
    const punto = usarGoogle ? await puntoGoogle(consulta, apiKey as string) : await puntoOsm(consulta);
    await esperar(usarGoogle ? PAUSA_MS : PAUSA_OSM_MS);
    return punto;
  };
  return { buscar, proveedor: usarGoogle ? 'Google Places (New)' : 'OpenStreetMap' };
}
