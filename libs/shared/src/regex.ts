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
