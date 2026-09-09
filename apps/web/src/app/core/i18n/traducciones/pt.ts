import type { Diccionario } from '../diccionario';
import comun from './pt/comun';
import publico from './pt/publico';
import cuenta from './pt/cuenta';
import reservas from './pt/reservas';
import comercio from './pt/comercio';
import admin from './pt/admin';
import legal from './pt/legal';
import catalogos from './pt/catalogos';
import paginas from './pt/paginas';

/**
 * Diccionario de pt, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const pt: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal, ...catalogos, ...paginas };

export default pt;
