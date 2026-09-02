/**
 * Idiomas de interfaz de Doogking.
 *
 * Son las ocho lenguas más habladas de la Unión Europea (nativos + segunda
 * lengua, Eurobarómetro): con ellas alrededor del 90% de la población europea
 * puede usar la plataforma en un idioma que domina, y quedan cubiertos al 100%
 * los países de `PAISES_SOPORTADOS`. El resto de lenguas oficiales de la UE no
 * llega al 3% cada una; se añadirán cuando haya oferta en esos mercados.
 *
 * El orden es el de la cabecera: español primero por ser el idioma fuente y el
 * del mercado inicial, inglés después por ser la lengua franca del EEE.
 */
export const IDIOMAS_SOPORTADOS = [
  { codigo: 'es', nombre: 'Español', nombreIngles: 'Spanish', locale: 'es-ES', bandera: 'ES' },
  { codigo: 'en', nombre: 'English', nombreIngles: 'English', locale: 'en-GB', bandera: 'GB' },
  { codigo: 'de', nombre: 'Deutsch', nombreIngles: 'German', locale: 'de-DE', bandera: 'DE' },
  { codigo: 'fr', nombre: 'Français', nombreIngles: 'French', locale: 'fr-FR', bandera: 'FR' },
  { codigo: 'it', nombre: 'Italiano', nombreIngles: 'Italian', locale: 'it-IT', bandera: 'IT' },
  { codigo: 'pt', nombre: 'Português', nombreIngles: 'Portuguese', locale: 'pt-PT', bandera: 'PT' },
  { codigo: 'pl', nombre: 'Polski', nombreIngles: 'Polish', locale: 'pl-PL', bandera: 'PL' },
  { codigo: 'nl', nombre: 'Nederlands', nombreIngles: 'Dutch', locale: 'nl-NL', bandera: 'NL' },
] as const;

export type IdiomaSoportado = (typeof IDIOMAS_SOPORTADOS)[number]['codigo'];

/** Idioma fuente del producto: todo texto nace aquí y aquí cae el respaldo. */
export const IDIOMA_DEFAULT: IdiomaSoportado = 'es';

const CODIGOS = new Set<string>(IDIOMAS_SOPORTADOS.map((i) => i.codigo));

/** true si el código (`'de'`, `'de-AT'`…) corresponde a un idioma soportado. */
export function esIdiomaSoportado(codigo: string | null | undefined): codigo is IdiomaSoportado {
  return !!codigo && CODIGOS.has(codigo);
}

/**
 * Normaliza lo que venga del navegador o de una cabecera `Accept-Language`
 * (`'de-AT'`, `'pt-BR'`, `'EN'`) al código de dos letras que usa la plataforma.
 * Devuelve `null` si el idioma no está soportado: quien llama decide el
 * respaldo, porque no es lo mismo no reconocer la preferencia del navegador
 * que no reconocer una elección explícita del usuario.
 */
export function normalizarIdioma(codigo: string | null | undefined): IdiomaSoportado | null {
  const base = (codigo ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return esIdiomaSoportado(base) ? base : null;
}

/** Ficha del idioma (nombre, locale, bandera); cae al idioma fuente si no existe. */
export function idiomaUi(codigo: string | null | undefined): (typeof IDIOMAS_SOPORTADOS)[number] {
  return IDIOMAS_SOPORTADOS.find((i) => i.codigo === codigo) ?? IDIOMAS_SOPORTADOS[0];
}
