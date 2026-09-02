import type { Diccionario } from '../diccionario';
import comun from './it/comun';
import publico from './it/publico';
import cuenta from './it/cuenta';
import reservas from './it/reservas';
import comercio from './it/comercio';
import admin from './it/admin';
import legal from './it/legal';

/**
 * Diccionario de it, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const it: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal };

export default it;
