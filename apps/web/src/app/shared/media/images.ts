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
  /** Logotipo sin la banda del eslogan — para heros donde el eslogan es texto. */
  logoMark: '/images/logo-doogking-mark.jpg',
  /** Marca compacta: la inicial "D" (cabecera, favicon, avatares de marca). */
  logoD: '/images/logo-doogking-d.svg',
  /**
   * Logo del footer con el fondo ya recortado (PNG con alfa). Va aparte del
   * resto porque los huecos de las letras llevan pintado el navy del footer:
   * fuera de ese fondo se verían como manchas oscuras.
   */
  logoFooter: '/images/logo-doogking-footer.png',
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

/**
 * Iconos SVG de las categorías caninas (`public/icons`). Trazo Royal King Blue
 * con acento Crown Gold: misma línea gráfica que el logo de Doogking.
 */
export const CATEGORIA_ICONOS: Record<string, string> = {
  alojamiento: '/icons/alojamiento.svg',
  guarderia: '/icons/guarderia.svg',
  transporte: '/icons/transporte.svg',
  veterinaria: '/icons/veterinaria.svg',
  peluqueria: '/icons/peluqueria.svg',
  adiestramiento: '/icons/adiestramiento.svg',
  hoteles: '/icons/hoteles.svg',
  seguros: '/icons/seguros.svg',
  explora: '/icons/explora.svg',
  mas: '/icons/mas-servicios.svg',
};

/** Iconos de la franja de confianza — blanco + dorado, para fondo navy. */
export const TRUST_ICONOS = {
  verificados: '/icons/trust-verificados.svg',
  reservaSegura: '/icons/trust-reserva-segura.svg',
  prioridad: '/icons/trust-prioridad.svg',
  rapidez: '/icons/trust-rapidez.svg',
  atencion: '/icons/trust-atencion.svg',
} as const;

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

/**
 * Banda fotográfica del bloque "¿Por qué Doogking.com?".
 *
 * Dos encuadres a propósito: en escritorio la banda es muy apaisada y recorta
 * casi todo el alto del original, así que necesita una foto con el perro
 * centrado; en móvil la banda es casi cuadrada y admite el hero habitual.
 */
export const BANDA_POR_QUE = {
  movil: '/images/hero-home.jpg',
  escritorio: '/images/alojamiento-exterior.jpg',
} as const;

/**
 * Fotos del bloque "¿Por qué Doogking.com?" — una por cada uno de los tres
 * valores, en lugar de iconos.
 *
 * TODO(D-3): sustituir por la fotografía de marca que aporte el cliente; basta
 * con cambiar estas tres rutas. Mientras tanto se usan assets ya verificados
 * del pool canino para no depender de URLs sin comprobar.
 */
export const MOTIVOS_IMAGES = {
  rapidez: pexels(1254140, 640),
  verificados: '/images/alojamiento-interior.jpg',
  atencion: pexels(2607544, 640),
} as const;

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
