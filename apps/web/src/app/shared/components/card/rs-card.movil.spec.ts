import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tarjeta de resultado en móvil. Enseña lo mismo que en escritorio: en su día
 * se recortó a cuatro filas —nombre, valoración, dos etiquetas y precio— y con
 * ello se perdían la distancia al centro, las reseñas, los distintivos y el
 * botón, que el cliente pidió recuperar (12-10). Lo que cambia con el ancho es
 * el tamaño, no el contenido.
 *
 * jsdom no evalúa media queries, así que lo que se vigila es la hoja.
 */
describe('tarjeta de resultado en móvil', () => {
  const hoja = readFileSync(
    join(__dirname, '..', '..', '..', '..', 'styles.scss'), 'utf8',
  );

  /** El bloque `@media (max-width: 860px)` que vive dentro de `.rs-hotel-card--horizontal`. */
  const bloqueMovil = (() => {
    const desde = hoja.indexOf('.rs-hotel-card--horizontal');
    expect(desde).toBeGreaterThan(-1);
    const inicio = hoja.indexOf('@media (max-width: 860px)', desde);
    expect(inicio).toBeGreaterThan(-1);
    return hoja.slice(inicio, hoja.indexOf('@media (max-width: 365px)', inicio));
  })();

  it('no debería apilar la tarjeta: la foto sigue a la izquierda', () => {
    expect(bloqueMovil).not.toContain('--rs-card-dir: column');
    expect(bloqueMovil).toContain('width: 102px');
  });

  it('debería dejar la foto cuadrada, no estirada al alto del cuerpo', () => {
    expect(bloqueMovil).toContain('aspect-ratio: 1;');
    expect(bloqueMovil).toContain('align-self: flex-start');
  });

  it('no debería esconder nada de lo que se ve en escritorio', () => {
    // El punto separador no es contenido: es lo único que se retira.
    const sinSeparador = bloqueMovil.replace(/\.rs-hotel-card__meta-sep \{[^}]*\}/, '');
    expect(sinSeparador).not.toMatch(/display:\s*none/);
  });

  it('debería dejar entera la ubicación con su distancia al centro', () => {
    expect(bloqueMovil).toMatch(/__meta-loc \{[^}]*white-space: normal/);
  });

  it('debería bajar la nota con sus reseñas a una fila propia bajo el nombre', () => {
    expect(bloqueMovil).toMatch(/__cabecera \{[^}]*flex-wrap: wrap/);
    expect(bloqueMovil).toContain('.rs-hotel-card__cabecera .rs-hotel-card__name { flex: 1 1 100%; }');
  });

  it('debería mantener el botón junto al precio y no a lo ancho', () => {
    // `.rs-btn--block` lo estiraba al ancho del cuerpo y lo empujaba a una
    // línea propia: dos filas más de alto por tarjeta.
    const pie = hoja.slice(hoja.indexOf('.rs-hotel-card__pie .rs-hotel-card__cta'));
    expect(pie.slice(0, 260)).toContain('width: auto');
  });

  it('debería quitar el aire que el cuerpo hereda de escritorio', () => {
    // `min-height` es lo que da el alto a `.rs-btn`: sin bajarlo, el botón
    // seguía midiendo 44 px por mucho `height` que se le pusiera.
    expect(bloqueMovil).toContain('min-height: 36px');
    expect(bloqueMovil).toContain('margin-top: 0');
    expect(bloqueMovil).toMatch(/__meta \{[^}]*margin-bottom: 0/);
  });
});
