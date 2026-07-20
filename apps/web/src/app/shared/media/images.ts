/**
 * Catálogo central de imágenes de Doogking.
 *
 * Los assets de marca (logo, hero, badges de categoría) viven en
 * `apps/web/public/images/` y se sirven localmente. Las fotos de contenido
 * demo se sirven desde el CDN público de Pexels (hotlinking sin API key).
 * Centralizar las URLs aquí permite cambiarlas en un solo lugar.
 */

/** Assets de marca Doogking (public/images). */
export const BRAND = {
  logo: '/images/logo-doogking.jpg',
  logoFooter: '/images/logo-doogking-footer.jpg',
  mascota: '/images/mascota-doogking.jpg',
  heroHome: '/images/hero-home.jpg',
  heroDetalle: '/images/hero-detalle.jpg',
  avatarPlaceholder: '/images/avatar-placeholder.jpg',
} as const;

/** Badges circulares de las 5 categorías caninas (public/images). */
export const CATEGORIA_BADGES: Record<string, string> = {
  alojamiento: '/images/categoria-alojamiento.jpg',
  transporte: '/images/categoria-transporte.jpg',
  veterinaria: '/images/categoria-veterinaria.jpg',
  peluqueria: '/images/categoria-peluqueria.jpg',
  adiestramiento: '/images/categoria-adiestramiento.jpg',
  hoteles: '/images/categoria-alojamiento.jpg',
};

/** Construye una URL del CDN de Pexels para un id de foto y un ancho dado. */
export function pexels(id: number, width = 800): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

/**
 * Imagen de respaldo garantizada (Unsplash, golden retriever). La directiva
 * `rsImg` la usa si una imagen no carga, de modo que nunca se muestra el
 * ícono de imagen rota.
 */
export const IMG_FALLBACK =
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80';

/** Ids Pexels de fotos caninas (alojamientos, perros felices, cuidado). */
const DOG_IMG_IDS = [
  1108099, // dos cachorros golden
  58997,   // perro corriendo en el campo
  1254140, // golden retriever sonriente
  1490908, // perro en manta
  1851164, // border collie
  2607544, // perro en cama
  1938126, // cachorro jugando
  1174081, // perro paseando
  1390361, // perro feliz hierba
  2253275, // perro con correa
];

/** Alojamientos caninos / espacios — pool reutilizable (assets locales primero). */
export const HOTEL_IMAGES: readonly string[] = [
  '/images/alojamiento-interior.jpg',
  '/images/alojamiento-exterior.jpg',
  '/images/alojamiento-boutique.jpg',
  '/images/ejemplo-alojamiento-1.jpg',
  '/images/ejemplo-alojamiento-2.jpg',
  pexels(1108099),
  pexels(1254140),
  pexels(2607544),
  pexels(1490908),
  pexels(1938126),
];

/** Alias semántico nuevo — mismo pool que HOTEL_IMAGES. */
export const ALOJAMIENTO_IMAGES = HOTEL_IMAGES;

/** Imágenes de fondo escénicas (perros / naturaleza). */
export const BG_IMAGES = {
  hero: '/images/hero-home.jpg',
  city: pexels(1174081, 1600),
  coast: pexels(58997, 1600),
  auth: '/images/mascota-doogking.jpg',
} as const;

/** Devuelve una imagen del pool canino por índice (cíclico). */
export function hotelImage(index: number, width = 800): string {
  const local = HOTEL_IMAGES[index % HOTEL_IMAGES.length];
  if (local.startsWith('/')) return local;
  return pexels(DOG_IMG_IDS[index % DOG_IMG_IDS.length], width);
}

/** Alias semántico nuevo de hotelImage. */
export const alojamientoImage = hotelImage;
