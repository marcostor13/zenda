import { FilterQuery } from 'mongoose';
import { claveUbicacion, escaparRegex, normalizarUbicacion, resolverMunicipio } from 'shared';

/**
 * Cómo se busca una población en Mongo.
 *
 * El buscador comparaba el texto tecleado con el que guardó el comercio, letra
 * a letra: «Villareal» no encontraba al negocio dado de alta como «villa-real»,
 * «malaga» no encontraba «Málaga» y «Vera» sacaba los listados de «Talavera de
 * la Reina». Estas dos funciones son la respuesta, y viven aquí para que el
 * catálogo y Explora busquen igual.
 */

/**
 * Colecciones **con** claves guardadas (`servicios`): se compara contra ellas,
 * que es lo que puede usar índice.
 *
 * Tres formas de casar, de más a menos precisa:
 * 1. La población se reconoce en el catálogo → se buscan todas sus claves, así
 *    que «Villarreal», «Villareal» y «Vila-real» son la misma búsqueda.
 * 2. No se reconoce → prefijo sobre la clave, que ya viene sin tildes ni
 *    puntuación: «castello» encuentra «Castellón de la Plana».
 * 3. Y siempre el texto original para los documentos anteriores a la migración,
 *    que todavía no tienen claves.
 */
export function condicionCiudadGuardada<T>(
  ciudad: string,
  campos: { clave: string; normalizada: string; texto: string },
): FilterQuery<T> | null {
  const clave = claveUbicacion(ciudad);
  if (!clave) return null;

  const resuelto = resolverMunicipio(ciudad);
  const condiciones: FilterQuery<T>[] = resuelto
    ? [{ [campos.clave]: { $in: resuelto.claves } } as FilterQuery<T>]
    : [{ [campos.clave]: new RegExp(`^${escaparRegex(clave)}`) } as FilterQuery<T>];

  // Por palabra y no por subcadena: «Vera» no debe sacar «Talavera de la Reina».
  const normalizada = normalizarUbicacion(ciudad);
  if (normalizada) {
    condiciones.push({
      [campos.normalizada]: new RegExp(`(^| )${escaparRegex(normalizada)}`),
    } as FilterQuery<T>);
  }

  condiciones.push({
    [campos.clave]: { $exists: false },
    [campos.texto]: new RegExp(escaparRegex(ciudad), 'i'),
  } as FilterQuery<T>);

  return { $or: condiciones } as FilterQuery<T>;
}

/**
 * Colecciones **sin** claves guardadas (`lugares`): se comparan las variantes
 * del nombre contra el texto tal cual, ancladas al principio de palabra.
 *
 * Es menos preciso que comparar claves —«Vila-real» y «vilareal» no casan si el
 * documento guarda una forma con separador distinto—, pero no exige migrar una
 * colección que ya nace con nombres canónicos, y cubre lo que de verdad falla:
 * las tildes y los nombres en otra lengua.
 */
export function condicionCiudadTexto<T>(ciudad: string, campo: string): FilterQuery<T> | null {
  const limpio = (ciudad ?? '').trim();
  if (!limpio) return null;

  const resuelto = resolverMunicipio(limpio);
  const formas = resuelto
    ? [resuelto.municipio.nombre, ...resuelto.municipio.alias]
    : [limpio];

  const variantes = [...new Set(formas.map((forma) => escaparRegex(forma.trim())))];
  return { [campo]: new RegExp(`(^|\\s)(${variantes.join('|')})`, 'i') } as FilterQuery<T>;
}
