import type { Diccionario } from '../diccionario';
import comun from './fr/comun';
import publico from './fr/publico';
import cuenta from './fr/cuenta';
import reservas from './fr/reservas';
import comercio from './fr/comercio';
import admin from './fr/admin';
import legal from './fr/legal';
import catalogos from './fr/catalogos';
import paginas from './fr/paginas';
import historial from './fr/historial';
import transporte from './fr/transporte';

/**
 * Diccionario de fr, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const fr: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal, ...catalogos, ...paginas, ...historial, ...transporte };

export default fr;
