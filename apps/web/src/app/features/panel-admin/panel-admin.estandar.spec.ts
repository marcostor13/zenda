import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardia del aspecto común del panel de administración.
 *
 * Cada vista se había ido definiendo su propia `.toolbar`, `.filtros` y
 * `.filtro-select` con valores distintos —el hueco entre filtros iba de 12 a
 * 16px y el tope de los desplegables de 200 a 240, o no existía—, y el buscador
 * heredaba el relleno de `.rs-inp` (52px de alto) mientras los desplegables
 * llevaban un `height` suelto (44px). En una fila eso es un escalón.
 *
 * Estas comprobaciones leen los componentes tal cual: si alguien vuelve a
 * declarar la barra en local, falla aquí y no delante del cliente.
 */
describe('Panel de administración — aspecto común', () => {
  const DIR = __dirname;

  const componentes = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.component.ts') && !f.endsWith('.spec.ts'))
    .map((f) => ({ nombre: f, fuente: fs.readFileSync(path.join(DIR, f), 'utf8') }));

  it('debería encontrar los componentes del panel', () => {
    expect(componentes.length).toBeGreaterThan(10);
  });

  /** Reglas que ahora viven una sola vez en `styles.scss`. */
  const REGLAS_PROHIBIDAS = [
    '.page-header {',
    '.page-title {',
    '.page-sub {',
    '.toolbar {',
    '.filtros {',
    '.filter-bar {',
    '.filtro-select {',
    '.search-input {',
  ];

  it.each(REGLAS_PROHIBIDAS)('ningún componente debería redefinir "%s"', (regla) => {
    const culpables = componentes.filter((c) => c.fuente.includes(regla)).map((c) => c.nombre);

    expect(culpables).toEqual([]);
  });

  /** Clases de plantilla que quedaron obsoletas al unificar. */
  const CLASES_PROHIBIDAS = [
    'class="page-header"',
    'class="page-title"',
    'class="page-sub"',
    'class="toolbar"',
    'class="filtros"',
    'class="filter-bar"',
  ];

  it.each(CLASES_PROHIBIDAS)('ninguna plantilla debería usar %s', (clase) => {
    const culpables = componentes.filter((c) => c.fuente.includes(clase)).map((c) => c.nombre);

    expect(culpables).toEqual([]);
  });

  /**
   * La barra ya no admite controles sueltos: cada uno va dentro de su
   * `.rs-toolbar__campo`, que es lo que le da la etiqueta visible y el ancho.
   */
  it('todo control de la barra debería ir dentro de un campo con etiqueta', () => {
    const conBarra = componentes.filter((c) => c.fuente.includes('class="rs-toolbar"'));
    expect(conBarra.length).toBeGreaterThan(0);

    const sinEtiqueta = conBarra
      .filter((c) => {
        const campos = (c.fuente.match(/rs-toolbar__campo/g) ?? []).length;
        const etiquetas = (c.fuente.match(/rs-toolbar__lbl/g) ?? []).length;
        return campos > 0 && etiquetas < campos - (c.fuente.match(/rs-toolbar__campo--buscador/g) ?? []).length;
      })
      .map((c) => c.nombre);

    expect(sinEtiqueta).toEqual([]);
  });

  /**
   * Los desplegables sólo llevaban `aria-label`, invisible: había que abrirlos
   * para saber qué filtraban.
   */
  it('los filtros deberían tener etiqueta visible, no sólo aria-label', () => {
    const conAria = componentes
      .filter((c) => /class="rs-inp rs-toolbar__control"[^>]*aria-label=/s.test(c.fuente))
      .map((c) => c.nombre);

    expect(conAria).toEqual([]);
  });
});
