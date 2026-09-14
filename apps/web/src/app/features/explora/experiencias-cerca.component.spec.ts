import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regresión de iOS: al buscar desde la home, el listado de resultados se veía
 * en el iPhone como una franja azul interminable y sin tarjetas.
 *
 * La franja era el degradado de respaldo de `.ec__img`. Safari/iOS no da por
 * definido el ancho de una caja con `aspect-ratio` cuando ese ancho sale del
 * estirado del contenedor, así que el `height: 100%` de la foto caía a su alto
 * natural y —al arrancar la caja en `min-height: auto`— ese alto natural pasaba
 * a ser el mínimo de la caja. Con una foto de comunidad de 4032x3024, cada
 * tarjeta del carrusel medía miles de píxeles.
 *
 * jsdom no hace layout ni evalúa media queries, así que lo que se vigila es la
 * hoja de estilos del componente.
 */
describe('experiencias cerca: la foto no puede imponer su tamaño', () => {
  const fuente = readFileSync(
    join(__dirname, 'experiencias-cerca.component.ts'), 'utf8',
  );

  const bloque = (selector: string): string => {
    const desde = fuente.indexOf(`${selector} {`);
    expect(desde).toBeGreaterThan(-1);
    return fuente.slice(desde, fuente.indexOf('\n    }', desde));
  };

  it('debería dar ancho explícito a la caja de la foto', () => {
    expect(bloque('.ec__img')).toContain('width: 100%');
  });

  it('debería poner a cero el mínimo automático de la caja de la foto', () => {
    const img = bloque('.ec__img');
    expect(img).toContain('min-height: 0');
    expect(img).toContain('min-width: 0');
  });

  it('debería sacar la foto del flujo para que no estire la caja', () => {
    const img = bloque('.ec__img');
    expect(img).toContain('position: relative');
    expect(img).toMatch(/img \{[^}]*position: absolute; inset: 0/);
  });

  it('debería impedir que el ancho natural de la foto ensanche la columna', () => {
    expect(bloque('.ec__lista')).toContain('> li { min-width: 0; }');
  });
});
