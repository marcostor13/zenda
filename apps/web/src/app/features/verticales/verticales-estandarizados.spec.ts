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
