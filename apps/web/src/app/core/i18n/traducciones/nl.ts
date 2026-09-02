import type { Diccionario } from '../diccionario';
import comun from './nl/comun';
import publico from './nl/publico';
import cuenta from './nl/cuenta';
import reservas from './nl/reservas';
import comercio from './nl/comercio';
import admin from './nl/admin';
import legal from './nl/legal';

/**
 * Diccionario de nl, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const nl: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal };

export default nl;
