/**
 * Direcciones legibles (slugs) para las fichas públicas de Doogking.
 *
 * Lo comparten el API —que los genera y los resuelve— y la web —que decide si
 * lo que llega en la URL es un id antiguo y hay que redirigir—. Si cada lado
 * tuviera su propia regla, el día que no coincidieran una ficha tendría dos
 * direcciones y Google las vería como contenido duplicado.
 *
 * Esquema elegido: `/<categoría>/<nombre>-<ciudad>`, un solo segmento tras la
 * categoría (`/alojamiento/reino-canino-valencia`). Se descartó
 * `/alojamiento/valencia/reino-canino` porque la ciudad dentro de la jerarquía
 * obliga a cambiar la URL si el negocio se muda, choca con rutas fijas de dos
 * segmentos (`/transporte/viaje/...`) y exigiría páginas de ciudad que hoy no
 * existen. La ciudad sigue dentro del slug: aporta la palabra clave que la
 * gente escribe en Google y desambigua los nombres repetidos.
 */

/** Tope de longitud. Por encima deja de ser legible y empieza a estorbar. */
export const SLUG_LARGO_MAXIMO = 70;

/**
 * Palabras que ya son rutas fijas bajo alguna categoría (`/transporte/empresas`,
 * `/explora/planificador`…). Un servicio cuyo slug fuera una de ellas quedaría
 * tapado por la ruta fija y no se podría abrir nunca.
 */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  'empresas', 'viaje', 'planificador', 'nuevo', 'nueva', 'editar', 'mapa',
  'buscar', 'buscador', 'resultados', 'reserva', 'reservas', 'pagar',
]);

/**
 * Convierte un texto en un fragmento de URL.
 *
 * `normalize('NFD')` separa cada letra de su tilde y el reemplazo borra las
 * tildes sueltas: «Júcar» queda en «jucar» y «Peñíscola» en «peniscola» sin
 * tabla de equivalencias.
 */
export function aSlug(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_LARGO_MAXIMO)
    .replace(/-+$/g, '');
}

/**
 * Slug de una ficha a partir de su nombre y su ciudad.
 *
 * Si el nombre ya lleva la ciudad («Peluquería Canina Valencia», «PetTransfer
 * Barcelona — Traslados») no se repite: `peluqueria-canina-valencia`, no
 * `peluqueria-canina-valencia-valencia`.
 */
export function slugDeFicha(nombre: string, ciudad?: string, porDefecto = 'ficha'): string {
  const deNombre = aSlug(nombre);
  const deCiudad = aSlug(ciudad ?? '');
  const yaLaLleva = !!deCiudad && `-${deNombre}-`.includes(`-${deCiudad}-`);
  const base = aSlug([deNombre, yaLaLleva ? '' : deCiudad].filter(Boolean).join(' '));
  return base || porDefecto;
}

/**
 * Añade un sufijo numérico hasta encontrar uno libre.
 *
 * `estaOcupado` lo decide quien llama, que es quien puede consultar la base de
 * datos. Las palabras reservadas cuentan como ocupadas. Se corta a los 50
 * intentos: si se llega ahí hay algo mal y es mejor fallar que seguir probando.
 */
export async function slugLibre(
  base: string,
  estaOcupado: (candidato: string) => Promise<boolean>,
): Promise<string> {
  const ocupado = async (candidato: string): Promise<boolean> =>
    SLUGS_RESERVADOS.has(candidato) || pareceObjectId(candidato) || estaOcupado(candidato);

  if (!(await ocupado(base))) return base;

  for (let sufijo = 2; sufijo <= 50; sufijo += 1) {
    const candidato = `${base}-${sufijo}`;
    if (!(await ocupado(candidato))) return candidato;
  }

  throw new Error(`No se encontró un slug libre para «${base}»`);
}

/**
 * `true` si el texto es un ObjectId de Mongo (24 hexadecimales).
 *
 * Las fichas aceptan las dos formas: el enlace antiguo por id, que puede estar
 * guardado en marcadores, correos o chats, y el nuevo por slug.
 */
export function pareceObjectId(valor: string | null | undefined): boolean {
  return /^[0-9a-f]{24}$/i.test(valor ?? '');
}

/** `true` si el valor tiene forma de slug válido (lo que genera {@link aSlug}). */
export function esSlugValido(valor: string | null | undefined): boolean {
  return !!valor && valor.length <= SLUG_LARGO_MAXIMO + 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(valor);
}

/**
 * Lo que va en la URL de una ficha: el slug si lo tiene, el id mientras la
 * migración no haya pasado por ella.
 */
export function claveDeFicha(ficha: { readonly id?: string; readonly _id?: unknown; readonly slug?: string | null }): string {
  return ficha.slug || ficha.id || String(ficha._id ?? '');
}
