import type { Diccionario } from '../diccionario';
import comun from './en/comun';
import publico from './en/publico';
import cuenta from './en/cuenta';
import reservas from './en/reservas';
import comercio from './en/comercio';
import admin from './en/admin';
import legal from './en/legal';
import catalogos from './en/catalogos';
import paginas from './en/paginas';

/**
 * Diccionario de en, repartido por zona de la aplicacion para que cada
 * fichero se pueda revisar entero de una sentada.
 */
const en: Diccionario = { ...comun, ...publico, ...cuenta, ...reservas, ...comercio, ...admin, ...legal, ...catalogos, ...paginas };

export default en;
