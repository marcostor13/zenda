/**
 * Poblaciones y provincias españolas para los selectores de la web.
 *
 * El catálogo **vive en `libs/shared`** desde que el buscador aprendió a
 * reconocer variantes: el API necesita la misma lista para normalizar lo que se
 * guarda y para entender lo que se busca, y dos copias se habrían separado a la
 * primera población añadida. Aquí sólo queda la puerta de entrada que ya usaban
 * el formulario de listados y el selector de población.
 */
export { CIUDADES_ES, PROVINCIAS_ES, MUNICIPIOS_ES } from 'shared';
export type { Municipio } from 'shared';
