import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La estrella del criterio de orden ya se ha perdido dos veces en móvil: los
 * tres controles se repartían el ancho a partes iguales y, como "Recomendados"
 * no cabía en un tercio de pantalla, una regla escondía los iconos. El fallo no
 * se ve en jsdom (no aplica media queries), así que se vigila la hoja.
 */
describe('estilos de la barra de control del listado', () => {
  const fuente = readFileSync(join(__dirname, 'rs-listado.component.ts'), 'utf8');

  it('no debería esconder ningún icono de la barra de control', () => {
    expect(fuente).not.toMatch(/\.ls__orden\s+rs-icon\s*\{[^}]*display:\s*none/);
    expect(fuente).not.toMatch(/\.ls__btn\s+rs-icon\s*\{[^}]*display:\s*none/);
  });

  it('debería dejar los tres controles del mismo ancho y en una fila', () => {
    // Medido en el navegador a 390 px: 107 px cada uno, alineados con el
    // buscador. Sólo caben iguales porque ninguno lo mide su contenido nativo.
    expect(fuente).toContain('grid-template-columns: repeat(3, 1fr)');
    expect(fuente).toContain('width: 100%');
  });

  it('no debería dejar que el select marque el ancho del control', () => {
    // Un select nativo reclama el ancho de su opción más larga ("Precio: de
    // menor a mayor") y descuadraba la fila de tres.
    expect(fuente).toContain('.ls__orden-txt');
    expect(fuente).toMatch(/\.ls__orden-sel\s*\{[^}]*position:\s*absolute/);
  });
});
