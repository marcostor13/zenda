/**
 * Comparar especies entre lo que declara el comercio y lo que dice la ficha
 * del animal.
 *
 * Hacen falta porque los dos lados escriben la especie de forma distinta y
 * ninguno está mal: la ficha del animal guarda la clave interna en minúscula
 * (`especie: 'perro'`, por defecto del esquema) y el alta del comercio elige de
 * un catálogo pensado para leerse (`'Perro'`, `'Hurón'`). Comparándolas tal
 * cual, `['Perro'].includes('perro')` es `false`: **toda clínica dada de alta
 * con el valor por defecto rechazaba a todos los perros**.
 */

/** Sin mayúsculas, sin acentos y sin la `s` del plural: "Perros" y "perro" son lo mismo. */
export function normalizarEspecie(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/s$/, '');
}

/**
 * ¿Está la especie del animal entre las que admite el negocio?
 *
 * Una lista vacía significa "cualquiera": es un dato que el comercio aún no ha
 * rellenado, no un "no admito nada".
 */
export function admiteEspecie(
  admitidas: readonly string[] | undefined,
  especie: unknown,
): boolean {
  if (!admitidas?.length) return true;
  if (typeof especie !== 'string' || !especie.trim()) return true;

  const buscada = normalizarEspecie(especie);
  return admitidas.some((a) => normalizarEspecie(a) === buscada);
}
