import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guardia anti-regresión del feedback 2026-08-20: el símbolo del euro va
 * **detrás** de la cifra, y el formato vive en un único sitio (`EurosPipe`).
 *
 * Antes cada plantilla lo resolvía por su cuenta —unas escribían `€24`, otras
 * `24 €`— y la misma pantalla podía contradecirse. Cambiarlo a mano en
 * cincuenta sitios no sirve de nada si el siguiente componente vuelve a
 * escribirlo suelto, así que la coherencia se comprueba aquí y no en la
 * revisión de cada PR.
 */

/** Importe con el símbolo delante: `€{{ x }}`, `€ {{ x }}`, `€${x}`, `'€' + x`. */
const EURO_DELANTE = /€\s*(\{\{|\$\{)|['"]€['"]\s*\+/;

/** Importe compuesto a mano con el símbolo detrás, en vez de con el pipe. */
const EURO_DETRAS_A_MANO = /(\}\}|\})\s*€/;

/**
 * Excepciones legítimas:
 *
 * - este mismo fichero y el pipe, que necesitan nombrar el símbolo;
 * - las etiquetas de formulario del tipo `Precio (€)`, que anotan la unidad de
 *   un campo y no son un importe;
 * - los precios de plan escritos como literal (`29 € / mes`).
 *
 * Ninguna de ellas casa con los patrones de arriba, así que la lista sólo
 * cubre los ficheros que sí los contienen por su propia naturaleza.
 */
const PERMITIDOS = [
  'shared/formato-euros.spec.ts',
  'shared/pipes/euros.pipe.ts',
  // La implementación del formato vive aquí desde que el pipe pasó a respetar
  // la divisa elegida en la cabecera: el pipe la reexporta y no la duplica.
  'core/moneda/importe.ts',
];

const RAIZ = join(__dirname, '..');

function ficherosDeProduccion(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) return ficherosDeProduccion(ruta);
    const esFuente = /\.(ts|html)$/.test(entrada) && !entrada.endsWith('.spec.ts');
    return esFuente ? [ruta] : [];
  });
}

function estaPermitido(ruta: string): boolean {
  return PERMITIDOS.some((permitido) => ruta.replace(/\\/g, '/').endsWith(permitido));
}

function infraccionesDe(patron: RegExp): string[] {
  return ficherosDeProduccion(RAIZ)
    .filter((ruta) => !estaPermitido(ruta))
    .flatMap((ruta) =>
      readFileSync(ruta, 'utf-8')
        .split('\n')
        .map((linea, i) => ({ ruta, linea: i + 1, texto: linea.trim() }))
        .filter((l) => patron.test(l.texto)),
    )
    .map((l) => `${l.ruta.replace(RAIZ, 'src/app')}:${l.linea} → ${l.texto.slice(0, 90)}`);
}

describe('Formato de los importes en euros', () => {
  it('no debería quedar ningún importe con el símbolo delante', () => {
    expect(infraccionesDe(EURO_DELANTE)).toEqual([]);
  });

  it('no debería componerse ningún importe a mano, habiendo pipe', () => {
    // `{{ x }} €` da el resultado correcto, pero se salta el redondeo, los
    // separadores y el guion de "sin importe" que el pipe ya resuelve.
    expect(infraccionesDe(EURO_DETRAS_A_MANO)).toEqual([]);
  });
});
