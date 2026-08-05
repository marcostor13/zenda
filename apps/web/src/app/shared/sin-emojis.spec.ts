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
 * Excepciones acordadas con la clienta:
 * - las banderas del selector de prefijo telefónico son la representación
 *   estándar de un país en ese control, y no hay equivalente en Lucide.
 * - este mismo fichero, que necesita nombrar los caracteres prohibidos.
 */
const PERMITIDOS = ['shared/catalogos/paises.catalogo.ts', 'shared/sin-emojis.spec.ts'];

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
