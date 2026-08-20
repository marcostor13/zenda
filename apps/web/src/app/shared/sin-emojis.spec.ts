import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guardia anti-regresión del TCK-8010: la clienta pidió iconografía vectorial
 * uniforme (Lucide, vía `<rs-icon>`) en toda la plataforma, sin emojis. Este
 * test recorre el código de producción del frontend y falla si vuelve a
 * aparecer uno, para que la coherencia no dependa de acordarse en cada PR.
 */

/** Pictogramas y dingbats que no deben usarse como iconografía de la UI. */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2705}\u{274C}\u{2B50}]/u;

/**
 * Única excepción: este mismo fichero, que necesita nombrar los caracteres
 * prohibidos.
 *
 * El catálogo de países estaba exento porque las banderas emoji no tenían
 * equivalente en Lucide. Ya lo tienen —`<rs-bandera>`, SVG propio— así que la
 * excepción se retira: los emoji de bandera además no se veían en Windows, que
 * los sustituye por las dos letras del código del país.
 */
const PERMITIDOS = ['shared/sin-emojis.spec.ts'];

const RAIZ = join(__dirname, '..');

function ficherosDeProduccion(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) return ficherosDeProduccion(ruta);
    const esFuente = /\.(ts|html|scss)$/.test(entrada) && !entrada.endsWith('.spec.ts');
    return esFuente ? [ruta] : [];
  });
}

function estaPermitido(ruta: string): boolean {
  return PERMITIDOS.some((permitido) => ruta.replace(/\\/g, '/').endsWith(permitido));
}

describe('Iconografía de la plataforma (TCK-8010)', () => {
  it('no debería quedar ningún emoji en el código de producción del frontend', () => {
    const infracciones = ficherosDeProduccion(RAIZ)
      .filter((ruta) => !estaPermitido(ruta))
      .flatMap((ruta) =>
        readFileSync(ruta, 'utf-8')
          .split('\n')
          .map((linea, i) => ({ ruta, linea: i + 1, texto: linea.trim() }))
          .filter((l) => EMOJI.test(l.texto)),
      )
      .map((l) => `${l.ruta.replace(RAIZ, 'src/app')}:${l.linea} → ${l.texto.slice(0, 80)}`);

    expect(infracciones).toEqual([]);
  });
});
