/**
 * Direcciones legibles para las fichas de *Explora*.
 *
 * Antes una ficha vivía en `/explora/6a8451c2756a745fe5e230eb`; con
 * `/explora/rio-jucar-riola` se sabe qué se va a abrir antes de abrirlo.
 *
 * La normalización, el sufijo ante colisiones y la detección de ObjectId viven
 * en `shared/slugs`: la misma regla que usan las fichas de servicio y la web.
 * Aquí sólo queda lo propio de los lugares.
 */
import { aSlug, pareceObjectId, slugLibre } from 'shared';

export { aSlug, pareceObjectId, slugLibre };

/**
 * Slug de una ficha: nombre y municipio.
 *
 * El municipio va dentro porque hay decenas de «Playa del Puerto» y «Parque
 * Central» repartidos por España; sin él, la segunda ficha con ese nombre
 * acabaría en `parque-central-2`, que no ayuda a nadie. Se conserva la regla
 * original (sin quitar la ciudad repetida) para que las fichas nuevas sigan el
 * patrón de las que la migración ya rellenó en producción.
 */
export function slugDeLugar(nombre: string, municipio?: string): string {
  const base = aSlug([nombre, municipio].filter(Boolean).join(' '));
  return base || 'lugar';
}
