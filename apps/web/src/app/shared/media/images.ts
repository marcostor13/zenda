/**
 * Catálogo central de imágenes (Pexels).
 *
 * Todas las imágenes de la plataforma se sirven desde el CDN público de Pexels
 * (images.pexels.com), que permite hotlinking sin API key. Centralizar las URLs
 * aquí permite cambiarlas en un solo lugar y aplicar fallbacks consistentes.
 *
 * Si en el futuro se integra la API de Pexels (PEXELS_API_KEY), este archivo es
 * el único punto que habría que reemplazar por un servicio dinámico.
 */

/** Construye una URL del CDN de Pexels para un id de foto y un ancho dado. */
export function pexels(id: number, width = 800): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

/**
 * Imagen de respaldo garantizada (Unsplash, verificada). El directivo
 * `rsImg` la usa si una imagen de Pexels no carga, de modo que nunca se
 * muestra el ícono de imagen rota.
 */
export const IMG_FALLBACK =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80';

/** Hoteles / habitaciones — pool reutilizable. */
export const HOTEL_IMAGES: readonly string[] = [
  pexels(271624), // fachada hotel moderno
  pexels(261102), // habitación luminosa
  pexels(1134176), // dormitorio de lujo
  pexels(258154), // cama king
  pexels(164595), // resort con piscina
  pexels(271643), // suite elegante
  pexels(1457842), // lobby contemporáneo
  pexels(1571460), // habitación con vista
  pexels(1660995), // dormitorio cálido
  pexels(279746), // interior boutique
];

/** Imágenes de fondo escénicas (viajes / Europa / paisajes). */
export const BG_IMAGES = {
  hero: pexels(338504, 1600), // paisaje de montañas
  city: pexels(466685, 1600), // ciudad al atardecer
  coast: pexels(1320684, 1600), // costa
  auth: pexels(258154, 1200), // interior acogedor
} as const;

/** Devuelve una imagen de hotel del pool por índice (cíclico). */
export function hotelImage(index: number, width = 800): string {
  const id = HOTEL_IMG_IDS[index % HOTEL_IMG_IDS.length];
  return pexels(id, width);
}

const HOTEL_IMG_IDS = [
  271624, 261102, 1134176, 258154, 164595, 271643, 1457842, 1571460, 1660995, 279746,
];
