import { claveUbicacion, distanciaEdicion, normalizarUbicacion } from './normalizar-ubicacion';
import { MUNICIPIOS_ES, Municipio } from './municipios';

/**
 * De qué forma se ha reconocido la población. Lo usa el diagnóstico para saber
 * qué se está adivinando y qué es una coincidencia exacta.
 */
export type OrigenCoincidencia = 'exacta' | 'alias' | 'aproximada';

export interface MunicipioResuelto {
  readonly municipio: Municipio;
  readonly origen: OrigenCoincidencia;
  /** Todas las claves con las que ese municipio puede estar guardado. */
  readonly claves: readonly string[];
}

/**
 * Longitud mínima para arriesgarse a corregir una errata. Por debajo, una sola
 * letra de diferencia cambia de municipio: «Vera» y «Vega», «Inca» e «Irún».
 */
const MINIMO_PARA_APROXIMAR = 5;

/** Índice `clave → municipio`, construido una vez. */
const POR_CLAVE = new Map<string, Municipio>();
for (const municipio of MUNICIPIOS_ES) {
  for (const forma of [municipio.nombre, ...municipio.alias]) {
    const clave = claveUbicacion(forma);
    if (clave && !POR_CLAVE.has(clave)) POR_CLAVE.set(clave, municipio);
  }
}

/** Todas las formas con las que un municipio puede estar escrito en la base. */
export function clavesDeMunicipio(municipio: Municipio): string[] {
  const claves = [municipio.nombre, ...municipio.alias].map(claveUbicacion).filter(Boolean);
  return [...new Set(claves)];
}

/**
 * Reconoce la población que hay detrás de un texto escrito por una persona.
 *
 * Tres intentos, de más a menos seguro:
 * 1. La clave coincide con el nombre canónico.
 * 2. La clave coincide con un alias (nombre oficial en otra lengua, forma
 *    castellanizada o errata frecuente).
 * 3. Una única población del catálogo está a una letra de distancia.
 *
 * El tercer paso exige que el candidato sea **único**: con dos empatados no se
 * elige ninguno, porque acertar a medias es peor que no corregir —el usuario ve
 * resultados de otro sitio y no entiende por qué.
 *
 * Devuelve `null` para lo que no está en el catálogo, que es la mayoría de los
 * 8.000 municipios españoles. Quien llama debe seguir buscando por texto
 * normalizado en ese caso, no dar la búsqueda por vacía.
 */
export function resolverMunicipio(texto: string): MunicipioResuelto | null {
  const clave = claveUbicacion(texto ?? '');
  if (!clave) return null;

  const exacto = POR_CLAVE.get(clave);
  if (exacto) {
    const origen = claveUbicacion(exacto.nombre) === clave ? 'exacta' : 'alias';
    return { municipio: exacto, origen, claves: clavesDeMunicipio(exacto) };
  }

  if (clave.length < MINIMO_PARA_APROXIMAR) return null;

  let candidato: Municipio | null = null;
  let empatado = false;

  for (const [claveCatalogo, municipio] of POR_CLAVE) {
    if (distanciaEdicion(clave, claveCatalogo, 1) > 1) continue;
    if (candidato && candidato !== municipio) { empatado = true; break; }
    candidato = municipio;
  }

  if (!candidato || empatado) return null;
  return { municipio: candidato, origen: 'aproximada', claves: clavesDeMunicipio(candidato) };
}

/**
 * Forma en la que se guarda una población: el nombre canónico si se reconoce y,
 * si no, el texto tal cual pero con los espacios arreglados.
 *
 * No inventa: un municipio que no está en el catálogo se respeta como lo
 * escribió el comercio. Lo que sí se garantiza es que dos altas de la misma
 * población conocida acaben escritas igual, que es lo que el buscador necesita.
 */
export function canonizarUbicacion(texto: string): {
  ciudad: string;
  ciudadNormalizada: string;
  ciudadClave: string;
  provincia?: string;
} {
  const limpio = (texto ?? '').trim().replace(/\s+/g, ' ');
  const resuelto = resolverMunicipio(limpio);
  const ciudad = resuelto ? resuelto.municipio.nombre : limpio;

  return {
    ciudad,
    ciudadNormalizada: normalizarUbicacion(ciudad),
    ciudadClave: claveUbicacion(ciudad),
    provincia: resuelto?.municipio.provincia,
  };
}

/**
 * ¿Casa este nombre de población con lo que se está escribiendo?
 *
 * Mira el nombre y también sus otras formas, que es lo que hacía falta para que
 * escribir «villareal» ofrezca «Vila-real» en el desplegable: quien da de alta
 * un comercio no tiene por qué saber cuál es el nombre oficial, y si la lista no
 * reacciona acaba escribiéndolo a mano y guardando una variante más.
 */
export function coincideUbicacion(nombre: string, termino: string): boolean {
  const clave = claveUbicacion(termino);
  if (!clave) return true;

  const municipio = POR_CLAVE.get(claveUbicacion(nombre));
  const formas = municipio ? [municipio.nombre, ...municipio.alias] : [nombre];

  return formas.some((forma) => {
    const claveForma = claveUbicacion(forma);
    return claveForma.includes(clave) || normalizarUbicacion(forma).includes(normalizarUbicacion(termino));
  });
}

/** Provincia de una población conocida; `undefined` si no está en el catálogo. */
export function provinciaDe(nombre: string): string | undefined {
  return POR_CLAVE.get(claveUbicacion(nombre))?.provincia;
}
