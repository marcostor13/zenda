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
  /**
   * Marca compacta: la inicial "D" (cabecera, favicon, avatares de marca).
   *
   * El ?v= es un rompe-cachés a mano: los ficheros de public/ conservan su
   * nombre, así que cambiar el dibujo no cambia la URL y quien ya lo tuviera
   * guardado seguía viendo el anterior. Al retocar la marca, sube el número.
   */
  logoD: '/images/logo-doogking-d.svg?v=2',
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
  funerarios: '/icons/funerarios.svg',
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
 * Una familia con su perro, no un perro solo: el bloque explica por qué elegir
 * Doogking, y lo que se vende es la tranquilidad de quien deja a su animal en
 * buenas manos. Un retrato canino ilustraba el producto; esto ilustra al
 * cliente (feedback 2026-08-20).
 *
 * Fotografía de marca del cliente (2026-08-31), ya no del CDN de stock. La
 * misma toma en dos anchos: el original mide 1536×1024 y la versión de 900px
 * ahorra ~90 KB en móvil, donde la banda nunca pasa de 640px de ancho.
 *
 * El encuadre está comprobado sobre el recorte real: a `center 20%` entran las
 * cuatro caras y la cabeza del perro (la banda de escritorio se queda con algo
 * menos de la mitad del alto original). Si algún día se cambia la foto, hay que
 * volver a medir esa cifra —no vale a ojo: la banda recorta más de la mitad.
 */
export const BANDA_POR_QUE = {
  movil: '/images/porque-familia-movil.jpg',
  escritorio: '/images/porque-familia.jpg',
} as const;

/**
 * Fotos del bloque "¿Por qué Doogking.com?" — una por cada uno de los tres
 * valores, en lugar de iconos.
 *
 * Fotografía de marca aportada por el cliente (2026-08-31), servida en local a
 * 800px de ancho: la tarjeta nunca supera los ~440px, así que da para pantalla
 * retina sin pagar el original de 1536px. Cada foto ilustra literalmente su
 * valor —la app en la mano, el sello de verificación, la operadora de noche—
 * para que la imagen refuerce el titular en lugar de decorarlo.
 */
export const MOTIVOS_IMAGES = {
  rapidez: '/images/porque-reserva.jpg',
  verificados: '/images/porque-verificados.jpg',
  atencion: '/images/porque-atencion.jpg',
} as const;

/**
 * Fotos de ambiente de `/explora`, agrupadas por tipo de lugar.
 *
 * **No son fotos del sitio concreto**, y es importante no venderlas como tal:
 * el censo trae más de cien fichas municipales ("Zona canina de Bétera") de las
 * que nadie ha hecho una foto todavía. Poner una playa cualquiera y llamarla
 * "Playa canina de Dénia" engañaría a quien conduce hasta allí.
 *
 * Lo que hacen es dar identidad visual al tipo de sitio —agua, hierba, terraza,
 * monte— para que la rejilla no sea la misma imagen de respaldo repetida cien
 * veces. En cuanto alguien sube una foto de verdad, `fotos[0]` manda (ver
 * `fotoDeLugar`).
 *
 * Ids del CDN de Pexels, cuya licencia permite el uso comercial sin atribución.
 */
export const EXPLORA_IMAGES: Record<string, readonly number[]> = {
  playa: [29546033, 9157298, 6744288, 17551980, 14958840, 18868411],
  rio: [32264343, 32264341, 24375044, 33145147, 24375033, 32320054],
  parque: [12265349, 36275896, 6729124, 38478448, 15413574],
  restaurante: [32544529, 21952862, 30070537, 144608],
  ruta: [28593498, 9810766, 19880821, 32949053, 36192733],
};

/** Pool de respaldo para un tipo que todavía no tenga el suyo. */
const EXPLORA_GENERICO = EXPLORA_IMAGES['parque'];

/**
 * Reparte los ids de un pool de forma estable a partir del identificador del
 * lugar. Con un índice o un aleatorio, la misma ficha cambiaría de foto al
 * reordenar la lista o al recargar; con el id, siempre le toca la misma.
 */
function indiceEstable(clave: string, total: number): number {
  let suma = 0;
  for (let i = 0; i < clave.length; i++) suma = (suma * 31 + clave.charCodeAt(i)) % 100000;
  return suma % total;
}

/** Datos mínimos que hacen falta para elegir la foto de un lugar. */
export interface LugarConFoto {
  readonly _id: string;
  readonly tipo: string;
  readonly fotos?: readonly string[];
}

/**
 * Foto con la que se pinta un lugar de `/explora`.
 *
 * La real gana siempre; si no la hay, una del pool de su tipo, elegida de forma
 * estable para que cada ficha tenga la suya y no cambie entre visitas.
 */
export function fotoDeLugar(lugar: LugarConFoto, width = 800): string {
  const propia = lugar.fotos?.[0];
  if (propia) return propia;

  const pool = EXPLORA_IMAGES[lugar.tipo] ?? EXPLORA_GENERICO;
  return pexels(pool[indiceEstable(lugar._id, pool.length)], width);
}

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
