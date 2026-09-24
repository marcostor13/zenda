import type { Diccionario } from '../diccionario';
import comun from './pl/comun';
import publico from './pl/publico';
import cuenta from './pl/cuenta';
import reservas from './pl/reservas';
import comercio from './pl/comercio';
import admin from './pl/admin';
import legal from './pl/legal';
import catalogos from './pl/catalogos';
import paginas from './pl/paginas';
import historial from './pl/historial';
import transporte from './pl/transporte';

/**
 * Diccionario de pl, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const pl: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal, ...catalogos, ...paginas, ...historial, ...transporte };

export default pl;
