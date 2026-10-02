/**
 * Dirección legible a partir de sus partes, sin huecos ni repeticiones.
 *
 * Las fichas montaban la línea concatenando a mano (`calle, número, barrio,
 * ciudad`) y con datos a medias salían cosas como «1, 1, , Valencia»: un
 * barrio vacío dejaba la coma colgando y una calle que era sólo el número del
 * portal se repetía. Aquí se descarta lo vacío, lo que no lleva ni una letra
 * (salvo el número pegado a su calle) y lo que ya ha salido antes.
 */

/** Mínimo de letras para que algo sea el nombre de una calle y no un número suelto. */
const MIN_LETRAS_CALLE = 2;

/** Para validar en los DTO: al menos dos letras en cualquier posición. */
export const PATRON_CALLE = /\p{L}[^\p{L}]*\p{L}/u;

/**
 * Lo que cabe en el campo «Número, piso o puerta»: «12», «12 B», «24, 2ºB»,
 * «s/n», «km 3». Empieza por letra o cifra y no pasa de una línea corta.
 */
export const PATRON_NUMERO_PORTAL = /^[\p{L}\p{N}][\p{L}\p{N}\s.,ºª°/'-]{0,29}$/u;

const letras = (texto: string): number => (texto.match(/\p{L}/gu) ?? []).length;

const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s.,;]+/g, ' ').trim();

const limpiar = (texto: string | null | undefined): string =>
  (texto ?? '').replace(/\s+/g, ' ').replace(/^[\s,;·.-]+|[\s,;·-]+$/g, '').trim();

/** ¿Parece el nombre de una calle? Tiene que tener letras: «1» o «-» no lo son. */
export function esCalleValida(calle: string | null | undefined): boolean {
  return letras(limpiar(calle)) >= MIN_LETRAS_CALLE;
}

/** ¿Parece un número de portal? Vacío también vale: el número es opcional. */
export function esNumeroPortalValido(numero: string | null | undefined): boolean {
  const valor = limpiar(numero);
  return !valor || PATRON_NUMERO_PORTAL.test(valor);
}

/**
 * «Calle Mayor, 12». Sin calle con letras no hay línea: un número suelto no
 * lleva a ninguna parte, y es lo que producía el «1, 1» de las fichas.
 */
export function lineaCalle(calle: string | null | undefined, numero?: string | null): string {
  const nombre = limpiar(calle);
  if (!esCalleValida(nombre)) return '';
  const portal = limpiar(numero);
  if (!portal || normalizar(nombre).endsWith(normalizar(portal))) return nombre;
  return `${nombre}, ${portal}`;
}

/**
 * Une las partes de una dirección con «, », saltándose las vacías, las que no
 * tienen ninguna letra (un «1» suelto, un «-») y las repetidas. Una ciudad que
 * aparece dentro del nombre de la calle («Calle de Valencia») no se descarta:
 * es otra cosa.
 */
export function formatearDireccion(partes: ReadonlyArray<string | null | undefined>, separador = ', '): string {
  const elegidas: string[] = [];
  for (const parte of partes) {
    const valor = limpiar(parte);
    if (!valor || letras(valor) === 0) continue;
    const clave = normalizar(valor);
    if (elegidas.some((ya) => normalizar(ya) === clave)) continue;
    elegidas.push(valor);
  }
  return elegidas.join(separador);
}
