/**
 * Direcciones legibles para las fichas de *Explora*.
 *
 * Antes una ficha vivía en `/explora/6a8451c2756a745fe5e230eb`. Funcionaba, pero
 * una dirección así no se puede leer, ni recordar, ni dictar por teléfono, y al
 * compartirla por WhatsApp no dice nada de lo que hay al otro lado. Con
 * `/explora/rio-jucar-riola` se sabe qué se va a abrir antes de abrirlo, que es
 * lo que pedía la auditoría de septiembre.
 */

/** Tope de longitud. Por encima deja de ser legible y empieza a estorbar. */
const LARGO_MAXIMO = 70;

/**
 * Convierte un texto en un fragmento de URL.
 *
 * `normalize('NFD')` separa cada letra de su tilde y el reemplazo borra las
 * tildes sueltas: así «Júcar» queda en «jucar» sin necesidad de una tabla de
 * equivalencias. La eñe se trata aparte —su descomposición es `n` + virgulilla,
 * así que cae sola— igual que la ç.
 */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_MAXIMO)
    .replace(/-+$/g, '');
}

/**
 * Slug de una ficha: nombre y municipio.
 *
 * El municipio va dentro porque hay decenas de «Playa del Puerto» y «Parque
 * Central» repartidos por España; sin él, la segunda ficha con ese nombre
 * acabaría en `parque-central-2`, que no ayuda a nadie.
 */
export function slugDeLugar(nombre: string, municipio?: string): string {
  const base = aSlug([nombre, municipio].filter(Boolean).join(' '));
  return base || 'lugar';
}

/**
 * Añade un sufijo numérico hasta encontrar uno libre.
 *
 * `estaOcupado` lo decide quien llama, que es quien puede consultar la base de
 * datos. Se corta a los 50 intentos: si se llega ahí, hay algo mal —un bucle o
 * una colisión artificial— y es mejor fallar que seguir probando para siempre.
 */
export async function slugLibre(
  base: string,
  estaOcupado: (candidato: string) => Promise<boolean>,
): Promise<string> {
  if (!(await estaOcupado(base))) return base;

  for (let sufijo = 2; sufijo <= 50; sufijo += 1) {
    const candidato = `${base}-${sufijo}`;
    if (!(await estaOcupado(candidato))) return candidato;
  }

  throw new Error(`No se encontró un slug libre para «${base}»`);
}

/**
 * `true` si el texto parece un ObjectId de Mongo.
 *
 * Sirve para que la ficha acepte las dos formas: el enlace antiguo por id, que
 * puede estar guardado en cualquier marcador, y el nuevo por slug.
 */
export function pareceObjectId(valor: string): boolean {
  return /^[0-9a-f]{24}$/i.test(valor);
}
