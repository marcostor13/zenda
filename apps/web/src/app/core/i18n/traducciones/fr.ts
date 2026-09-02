import type { Diccionario } from '../diccionario';
import comun from './fr/comun';
import publico from './fr/publico';
import cuenta from './fr/cuenta';
import reservas from './fr/reservas';
import comercio from './fr/comercio';
import admin from './fr/admin';
import legal from './fr/legal';

/**
 * Diccionario de fr, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const fr: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal };

export default fr;
