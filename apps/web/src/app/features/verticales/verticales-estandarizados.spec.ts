import { readFileSync } from 'fs';
import { join } from 'path';
import { VERTICALES_UI, enlaceAServicio } from '../../shared/verticales/verticales.config';

/**
 * Guardia de estandarización: todas las categorías se comportan igual.
 *
 * Veterinaria y peluquería llevaban tiempo sin ficha —no tenían ruta `:id` ni
 * entrada en el mapa de configuraciones—, así que sus tarjetas devolvían al
 * listado y era imposible ver el detalle de un comercio. El fallo no lo cazaba
 * ningún test porque cada pieza, por separado, era coherente consigo misma.
 *
 * Se lee el código fuente en vez de importar los módulos: las rutas cargan
 * componentes con `import()` perezoso y montarlos aquí no aporta nada.
 */
const RAIZ = join(__dirname, '..', '..');

const rutas = readFileSync(join(RAIZ, 'app.routes.ts'), 'utf-8');
const detalle = readFileSync(join(__dirname, 'vertical-detalle.component.ts'), 'utf-8');
const alojamiento = readFileSync(
  join(RAIZ, 'features', 'alojamiento', 'alojamiento.routes.ts'), 'utf-8',
);

/** Alojamiento y transporte llevan sus rutas en un fichero propio. */
const CON_RUTAS_PROPIAS = new Set(['alojamiento', 'transporte']);

/** …y su propia pantalla de ficha, no la genérica. */
const CON_FICHA_PROPIA = new Set(['alojamiento', 'transporte']);

describe('estandarización de las categorías', () => {
  it('debería haber una ficha para cada categoría', () => {
    const sinFicha = VERTICALES_UI
      .filter((v) => !CON_RUTAS_PROPIAS.has(v.key))
      .filter((v) => !rutas.includes(`path: '${v.key}/:id'`))
      .map((v) => v.key);

    expect(sinFicha).toEqual([]);
  });

  it('debería haber una configuración de detalle para cada categoría', () => {
    // Sin ella la ficha abriría con los textos de transporte, que es el
    // respaldo del componente.
    const sinConfig = VERTICALES_UI
      .filter((v) => !CON_FICHA_PROPIA.has(v.key))
      .filter((v) => !detalle.includes(`\n  ${v.key}: {`))
      .map((v) => v.key);

    expect(sinConfig).toEqual([]);
  });

  it('debería enlazar a la ficha desde el listado en todas las categorías', () => {
    for (const v of VERTICALES_UI) {
      expect(enlaceAServicio(v.key, 'servicio-1')).toEqual([v.route, 'servicio-1']);
    }
  });

  it('debería conservar la ficha propia de alojamiento', () => {
    // Tiene pantalla propia (espacios, políticas, reseñas): la genérica no la
    // sustituye, sólo cubre a las que no tienen una.
    expect(alojamiento).toContain(':id');
  });
});

/**
 * Alojamiento tiene su propia pantalla, así que su maquetación puede
 * desincronizarse de la genérica sin que nada se rompa: es justo lo que pasó
 * —la galería iba en una caja de 480px con las miniaturas en columna, y el
 * titular y el panel de reserva arrancaban mucho más arriba que en el resto de
 * categorías. Estas comprobaciones fijan lo que tiene que coincidir.
 */
describe('la ficha de alojamiento va al mismo ritmo que la genérica', () => {
  const fichaAlojamiento = readFileSync(
    join(RAIZ, 'features', 'alojamiento', 'components', 'alojamiento-detalle.component.ts'),
    'utf-8',
  );

  /**
   * Valor de una propiedad **dentro** del bloque de un selector.
   *
   * Se cuentan las llaves en vez de cortar por la primera: los bloques llevan
   * media queries anidadas, y buscando a partir del selector sin más se acababa
   * leyendo la regla de otro selector de más abajo.
   */
  const valorDe = (fuente: string, selector: string, propiedad: string): string | null => {
    const inicio = fuente.indexOf(selector);
    if (inicio === -1) return null;

    let profundidad = 0;
    let fin = inicio;
    for (let i = fuente.indexOf('{', inicio); i < fuente.length; i++) {
      if (fuente[i] === '{') profundidad++;
      else if (fuente[i] === '}' && --profundidad === 0) { fin = i; break; }
    }

    const bloque = fuente.slice(inicio, fin);
    const encontrado = new RegExp(`${propiedad}:\\s*([^;]+);`).exec(bloque);
    if (!encontrado) return null;

    // `16 / 10` y `16/10` son el mismo valor: lo que se compara es la
    // maquetación, no cómo la escribió cada uno.
    return encontrado[1].trim().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
  };

  it('debería dejar el mismo aire entre la galería y el contenido', () => {
    expect(valorDe(fichaAlojamiento, '.gallery {', 'margin-bottom'))
      .toBe(valorDe(detalle, '.gallery {', 'margin-bottom'));
  });

  it('debería usar el mismo panel lateral y el mismo hueco', () => {
    expect(valorDe(fichaAlojamiento, '.detalle-body {', 'grid-template-columns'))
      .toBe(valorDe(detalle, '.vd-body {', 'grid-template-columns'));
    expect(valorDe(fichaAlojamiento, '.detalle-body {', 'gap'))
      .toBe(valorDe(detalle, '.vd-body {', 'gap'));
  });

  it('debería usar el mismo tamaño de titular', () => {
    expect(valorDe(fichaAlojamiento, '.info-header__name', 'font-size'))
      .toBe(valorDe(detalle, '.info-header__name', 'font-size'));
  });

  it('debería colocar las miniaturas debajo de la foto, no en una columna', () => {
    // En columna, la galería era una caja alta y todo lo de debajo subía.
    expect(valorDe(fichaAlojamiento, '.gallery__thumbs', 'margin-top')).not.toBeNull();
    expect(valorDe(fichaAlojamiento, '.gallery__thumbs', 'flex-direction')).toBeNull();
  });

  it('debería repartir la fila de miniaturas en las mismas columnas', () => {
    // Generándolas a partir del contenido, una ficha con dos fotos sacaba dos
    // miniaturas de media pantalla cada una.
    expect(valorDe(fichaAlojamiento, '.gallery__thumbs', 'grid-template-columns'))
      .toBe(valorDe(detalle, '.gallery__thumbs', 'grid-template-columns'));
    expect(valorDe(fichaAlojamiento, '.gallery__thumbs', 'grid-auto-columns')).toBeNull();
  });

  it('debería dar a las miniaturas la misma proporción', () => {
    expect(valorDe(fichaAlojamiento, '.gallery__thumb {', 'aspect-ratio'))
      .toBe(valorDe(detalle, '.gallery__thumb {', 'aspect-ratio'));
  });

  it('debería separar la miga de pan de la barra de navegación', () => {
    // `.vd-wrap` lo hace con padding-block; la ficha de alojamiento no tenía
    // ninguno y arrancaba pegada.
    expect(valorDe(fichaAlojamiento, '.detalle-wrap {', 'padding-block')).not.toBeNull();
  });
});
