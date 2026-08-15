/**
 * Enlaces a Google Maps a partir de las coordenadas guardadas.
 *
 * El mapa de la web lo dibuja Leaflet sobre OpenStreetMap: no hace falta ninguna
 * clave en el navegador ni se paga por carga. Google entra donde de verdad
 * aporta —abrir la ficha del sitio y calcular la ruta desde donde estás— con
 * las **URLs universales**, que funcionan en escritorio y abren la app nativa
 * en el móvil.
 *
 * Documentación: https://developers.google.com/maps/documentation/urls/get-started
 */
export interface PuntoUbicacion {
  readonly lat?: number;
  readonly lng?: number;
  /** Alternativa cuando el negocio todavía no tiene coordenadas exactas. */
  readonly direccion?: string;
  readonly ciudad?: string;
  readonly nombre?: string;
}

const BASE_BUSQUEDA = 'https://www.google.com/maps/search/?api=1&query=';
const BASE_RUTA = 'https://www.google.com/maps/dir/?api=1&destination=';

/** true si el punto se puede situar de forma exacta en un mapa. */
export function tieneCoordenadas(punto: PuntoUbicacion): boolean {
  return Number.isFinite(punto.lat) && Number.isFinite(punto.lng);
}

/**
 * Consulta con la que Google localiza el sitio. Se prefieren las coordenadas:
 * una dirección escrita a mano puede resolverse en otra calle del mismo nombre,
 * y el punto exacto no admite ambigüedad.
 */
function consulta(punto: PuntoUbicacion): string | null {
  if (tieneCoordenadas(punto)) return `${punto.lat},${punto.lng}`;

  // El nombre solo no localiza nada: hace falta calle o ciudad. Enviar "Villa
  // Canina" a secas abriría un mapa del mundo con resultados de cualquier país.
  if (!punto.direccion && !punto.ciudad) return null;

  return [punto.nombre, punto.direccion, punto.ciudad].filter(Boolean).join(', ');
}

/** Abre el sitio en Google Maps. `null` si no hay ni coordenadas ni dirección. */
export function enlaceGoogleMaps(punto: PuntoUbicacion): string | null {
  const termino = consulta(punto);
  return termino ? `${BASE_BUSQUEDA}${encodeURIComponent(termino)}` : null;
}

/** Ruta hasta el sitio desde la posición del usuario (la pone Google). */
export function enlaceComoLlegar(punto: PuntoUbicacion): string | null {
  const termino = consulta(punto);
  return termino ? `${BASE_RUTA}${encodeURIComponent(termino)}` : null;
}
