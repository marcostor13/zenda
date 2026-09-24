import type { Diccionario } from '../diccionario';
import comun from './nl/comun';
import publico from './nl/publico';
import cuenta from './nl/cuenta';
import reservas from './nl/reservas';
import comercio from './nl/comercio';
import admin from './nl/admin';
import legal from './nl/legal';
import catalogos from './nl/catalogos';
import paginas from './nl/paginas';
import historial from './nl/historial';
import transporte from './nl/transporte';

/**
 * Diccionario de nl, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const nl: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal, ...catalogos, ...paginas, ...historial, ...transporte };

export default nl;
