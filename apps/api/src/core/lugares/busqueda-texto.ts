import { FilterQuery } from 'mongoose';
import { TipoLugar, regexSinTildes } from 'shared';

/**
 * Palabras que no dicen nada del sitio que se busca. Sin quitarlas, «tienda de
 * animales para mi perro» exigiría que la ficha contuviera «para» y «perro».
 */
const PALABRAS_VACIAS = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los', 'mi', 'mis', 'para', 'por',
  'que', 'un', 'una', 'unos', 'unas', 'y', 'o', 'cerca', 'donde', 'sitio', 'sitios', 'lugar',
  'lugares', 'perro', 'perros', 'perrito', 'mascota', 'mascotas', 'animal', 'animales', 'pet',
  'friendly', 'dog', 'canino', 'canina', 'caninos', 'caninas', 'ir', 'puedo', 'pueda', 'quiero',
  'busco', 'hay', 'mejor', 'mejores', 'buen', 'buena', 'buenos', 'buenas',
]);

/** Palabras que nombran un tipo de lugar aunque no aparezcan en la ficha. */
const SINONIMOS_TIPO: ReadonlyArray<readonly [TipoLugar, RegExp]> = [
  [TipoLugar.PLAYA, /^(playas?|calas?|beach(es)?)$/],
  [TipoLugar.PARQUE, /^(parques?|pipican(es)?|park)$/],
  [TipoLugar.RESTAURANTE,
    /^(restaurantes?|cafeterias?|cafes?|bar(es)?|terrazas?|comer|cenar|desayunar|brunch|tapas|comida)$/],
  [TipoLugar.RUTA, /^(rutas?|senderos?|senderismo|excursion(es)?|paseos?)$/],
  [TipoLugar.RIO, /^(rios?|lagos?|embalses?|pantanos?|bano|banarse)$/],
  [TipoLugar.TIENDA, /^(tiendas?|piensos?|accesorios?|comida|kiwoko|tiendanimal|miscota|shop)$/],
];

const CAMPOS_TEXTO = ['nombre', 'ubicacion.ciudad', 'ubicacion.provincia', 'ubicacion.direccion', 'atributos.cadena'];

const MAX_PALABRAS = 6;

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Palabras con significado del texto libre, sin tildes ni palabras vacías. */
export function palabrasDeBusqueda(texto: string): string[] {
  return sinTildes(texto)
    .split(/[^a-z0-9ñ'·-]+/)
    .map((palabra) => palabra.trim())
    .filter((palabra) => palabra.length >= 2 && !PALABRAS_VACIAS.has(palabra))
    .slice(0, MAX_PALABRAS);
}

function tiposDe(palabra: string): TipoLugar[] {
  return SINONIMOS_TIPO.filter(([, patron]) => patron.test(palabra)).map(([tipo]) => tipo);
}

function condicionPalabra<T>(palabra: string): FilterQuery<T> {
  const regex = regexSinTildes(palabra);
  const opciones: FilterQuery<T>[] = CAMPOS_TEXTO.map((campo) => ({ [campo]: regex }) as FilterQuery<T>);
  const tipos = tiposDe(palabra);
  if (tipos.length) opciones.push({ tipo: { $in: tipos } } as FilterQuery<T>);
  return { $or: opciones } as FilterQuery<T>;
}

/**
 * Condición de Mongo para buscar lugares por texto libre.
 *
 * Cada palabra casa con el nombre, la población, la provincia, la dirección, la
 * cadena o —si es un sinónimo— con el tipo: «cafetería Valencia» encuentra los
 * restaurantes de Valencia aunque ninguno se llame «cafetería».
 *
 * `todas` exige cada palabra; `alguna` se conforma con una. Devuelve null si no
 * queda ninguna palabra con significado. Va dentro de `$and` para no pisar el
 * `$or` de otros filtros al combinarse con `Object.assign`.
 */
export function condicionTextoLugar<T>(texto: string, modo: 'todas' | 'alguna'): FilterQuery<T> | null {
  const palabras = palabrasDeBusqueda(texto);
  if (!palabras.length) return null;

  const porPalabra = palabras.map((palabra) => condicionPalabra<T>(palabra));
  return modo === 'todas'
    ? ({ $and: porPalabra } as FilterQuery<T>)
    : ({ $and: [{ $or: porPalabra.flatMap((c) => (c as { $or: FilterQuery<T>[] }).$or) }] } as FilterQuery<T>);
}
