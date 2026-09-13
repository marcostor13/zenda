import type { Diccionario } from '../diccionario';
import comun from './de/comun';
import publico from './de/publico';
import cuenta from './de/cuenta';
import reservas from './de/reservas';
import comercio from './de/comercio';
import admin from './de/admin';
import legal from './de/legal';
import catalogos from './de/catalogos';
import paginas from './de/paginas';
import historial from './de/historial';

/**
 * Diccionario de de, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const de: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal, ...catalogos, ...paginas, ...historial };

export default de;
