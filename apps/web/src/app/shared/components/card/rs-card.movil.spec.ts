import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Alto de la tarjeta de resultado en móvil. Los bocetos del cliente dejan la
 * tarjeta en cuatro filas —nombre, valoración, dos etiquetas y precio— con la
 * foto ocupando algo más de una cuarta parte del ancho. Antes se apilaba con
 * una foto 16/9 y arrastraba dos filas más (distintivos y "IVA incluido"), lo
 * que la dejaba por encima de 250 px: dos resultados por pantallazo.
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
    return hoja.slice(inicio, hoja.indexOf('@media (max-width: 400px)', inicio));
  })();

  it('no debería apilar la tarjeta: en apaisado caben cuatro por pantalla', () => {
    expect(bloqueMovil).not.toContain('--rs-card-dir: column');
    expect(bloqueMovil).toContain('width: 102px');
  });

  it('debería dejar que el texto marque el alto, no la proporción de la foto', () => {
    expect(bloqueMovil).toContain('aspect-ratio: auto');
    expect(bloqueMovil).toContain('align-self: stretch');
  });

  it('debería quitar las dos filas que no salen en los bocetos', () => {
    expect(bloqueMovil).toMatch(/\.rs-hotel-card__destacados\s*\{\s*display:\s*none/);
    expect(bloqueMovil).toMatch(/\.rs-hotel-card__nota\s*\{\s*display:\s*none/);
  });

  it('debería dejar las etiquetas en una sola fila', () => {
    expect(bloqueMovil).toContain('.rs-hotel-card__amenities .rs-amenity:nth-child(n+3) { display: none; }');
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

  it('debería esconder la acción que sólo repite el enlace de la tarjeta', () => {
    expect(bloqueMovil).toMatch(/\.rs-hotel-card__cta--escritorio \{ display: none; \}/);
  });
});
