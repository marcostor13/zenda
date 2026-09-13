/**
 * Normalización de nombres de población.
 *
 * El buscador comparaba el texto tecleado con `ubicacion.ciudad` tal cual está
 * guardado, así que cualquier diferencia de forma —una tilde, un guion, un
 * artículo— devolvía cero resultados sobre un comercio que sí existía. El caso
 * que lo destapó: un negocio guardado como «villa-real» no aparecía al buscar
 * «Villareal».
 *
 * Aquí se define **la** forma de comparar poblaciones en toda la plataforma:
 * dos textos son la misma población si coinciden sus claves.
 */

/** Artículos iniciales que la gente escribe o se come indistintamente. */
const ARTICULOS_INICIALES = ['el', 'la', 'los', 'las', 'l', 'els', 'les', 'a', 'o', 'as', 'os'];

/**
 * Texto comparable: minúsculas, sin tildes y con la puntuación convertida en
 * espacios simples.
 *
 * `normalize('NFD')` separa cada letra de su tilde y el reemplazo borra las
 * tildes sueltas, así «Castelló» y «Castello» caen en lo mismo sin tabla de
 * equivalencias. La eñe se conserva como `n` a propósito: quien escribe «La
 * Coruna» quiere encontrar «A Coruña».
 */
export function normalizarUbicacion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Clave de comparación: la forma normalizada sin espacios ni artículo inicial.
 *
 * Sin espacios porque la separación es justo lo que no se respeta al escribir:
 * «Vila-real», «vila real» y «Villareal» son la misma población para quien
 * busca, y sólo coinciden después de juntarlas. Sin artículo porque «El Ejido»
 * y «Ejido» también lo son.
 */
export function claveUbicacion(texto: string): string {
  const palabras = normalizarUbicacion(texto).split(' ').filter(Boolean);
  if (palabras.length > 1 && ARTICULOS_INICIALES.includes(palabras[0])) palabras.shift();

  return palabras.join('');
}

/**
 * Distancia de edición (Levenshtein) acotada: cuenta inserciones, borrados y
 * sustituciones hasta `tope`, y en cuanto lo supera deja de calcular.
 *
 * El tope no es una optimización: es lo que evita que «Denia» se resuelva como
 * «Vera». Comparar dos poblaciones que no se parecen no tiene por qué costar la
 * matriz entera.
 */
export function distanciaEdicion(a: string, b: string, tope = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    let minimoFila = i;

    for (let j = 1; j <= b.length; j += 1) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + coste);
      minimoFila = Math.min(minimoFila, actual[j]);
    }

    if (minimoFila > tope) return tope + 1;
    anterior = actual;
  }

  return anterior[b.length];
}
