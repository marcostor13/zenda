/**
 * Reglas de URL que aplica el servidor de la web (`server.ts`) antes de
 * renderizar. Viven aquí, como funciones puras, para poder probarlas sin
 * levantar Express.
 */

/** Categorías con ficha propia bajo `/<categoría>/<slug>`. Coincide con `app.routes.ts`. */
const CATEGORIAS_CON_FICHA = [
  'alojamiento', 'transporte', 'veterinaria', 'peluqueria',
  'adiestramiento', 'hoteles', 'seguros', 'funerarios',
] as const;

const FICHA_POR_ID = new RegExp(
  `^/(${[...CATEGORIAS_CON_FICHA, 'explora'].join('|')})/([0-9a-f]{24})/?$`,
  'i',
);

export interface FichaPorId {
  /** Primer segmento de la ruta: la categoría o `explora`. */
  readonly segmento: string;
  readonly id: string;
}

/**
 * Si la ruta es una ficha pedida por su id antiguo (`/alojamiento/6aa4…`),
 * devuelve la categoría y el id para buscar su slug y responder con un 301.
 */
export function fichaPorId(ruta: string): FichaPorId | null {
  const coincidencia = FICHA_POR_ID.exec(ruta);
  if (!coincidencia) return null;
  return { segmento: coincidencia[1].toLowerCase(), id: coincidencia[2].toLowerCase() };
}

/** Endpoint del API que devuelve la ficha (y con ella su `slug`). */
export function urlFichaApi(apiUrl: string, ficha: FichaPorId): string {
  const base = apiUrl.replace(/\/+$/, '');
  return ficha.segmento === 'explora'
    ? `${base}/lugares/${ficha.id}`
    : `${base}/catalog/servicios/${ficha.id}?vertical=${encodeURIComponent(ficha.segmento)}`;
}

/** Destino del 301: la ficha por su slug, conservando la consulta (`?desde=…`). */
export function destinoDeSlug(ficha: FichaPorId, slug: string, consulta = ''): string {
  return `/${ficha.segmento}/${encodeURIComponent(slug)}${consulta}`;
}

/**
 * Zonas que no deben salir en Google: detrás de la sesión, pasos de pago,
 * enlaces de un solo uso y resultados de búsqueda libre.
 *
 * Se marcan con la cabecera `X-Robots-Tag` además de con `robots.txt`: el
 * `Disallow` sólo frena el rastreo, y una URL bloqueada que alguien enlace
 * puede acabar listada sin contenido. Estas rutas se pintan en el navegador
 * (`app.routes.server.ts`), así que la cabecera es lo único que el rastreador
 * ve sin ejecutar JavaScript.
 */
const RUTA_PRIVADA =
  /^\/(?:admin|comercio|perfil|perros|reservas|favoritos|presupuestos|auth|carrito|valorar|buscador|proximamente|transporte\/viaje)(?:\/|$)/i;

export function esRutaPrivada(ruta: string): boolean {
  return RUTA_PRIVADA.test(ruta);
}
