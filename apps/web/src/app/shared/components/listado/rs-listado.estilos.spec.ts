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

  it('debería dejar que cada control mida lo suyo en móvil', () => {
    // Repartir el ancho en tres es lo que obligaba a recortar el contenido.
    expect(fuente).not.toContain('grid-template-columns: repeat(3, 1fr)');
    expect(fuente).toContain('.ls__orden, .ls__btn { flex: none; }');
  });
});
