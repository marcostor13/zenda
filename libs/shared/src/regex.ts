/**
 * Escapado de texto de usuario antes de meterlo en una expresión regular.
 *
 * Existe por una inconsistencia real: la misma línea de escapado estaba copiada
 * en siete sitios (admin, auditoría, comercios, incidencias, reviews…) y
 * **faltaba justo en los buscadores públicos** —catálogo, lugares y
 * planificador—, que son los únicos accesibles sin autenticar. Una consulta como
 * `?ciudad=(a+)+$` deja el event loop de Node dando vueltas: un `RegExp`
 * construido con texto sin escapar no es un filtro, es código que escribe el
 * visitante.
 *
 * @example
 * new RegExp(escaparRegex(ciudad), 'i')   // busca la ciudad, literalmente
 */
export function escaparRegex(termino: string): string {
  return termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `RegExp` insensible a mayúsculas que busca el término **como texto literal**. */
export function regexLiteral(termino: string): RegExp {
  return new RegExp(escaparRegex(termino), 'i');
}

/** Cada vocal o eñe casa con todas sus variantes con y sin tilde. */
const VARIANTES_SIN_TILDE: Readonly<Record<string, string>> = {
  a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]', c: '[cç]',
};

/**
 * `RegExp` literal e insensible a mayúsculas **y a tildes**: «cafeteria»
 * encuentra «Cafetería» y «xabia» encuentra «Xàbia». Se usa en colecciones
 * pequeñas sin campo normalizado guardado, como los lugares de Explora.
 */
export function regexSinTildes(termino: string): RegExp {
  const base = termino.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const patron = [...base]
    .map((letra) => VARIANTES_SIN_TILDE[letra] ?? escaparRegex(letra))
    .join('');
  return new RegExp(patron, 'i');
}
