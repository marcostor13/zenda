import { test, expect, interceptarApi } from './fixtures/api';

/**
 * Explora, recorrido completo en el navegador: del listado a la ficha por su
 * dirección legible.
 *
 * Nace de un fallo del 2026-09-15: `/explora/rio-jucar-a-su-paso-por-corbera-corbera`
 * contestaba «No hemos encontrado este sitio» aunque la ficha existía y estaba
 * publicada. La pantalla pedía la ficha y sus aportaciones a la vez, el API
 * exigía un ObjectId para las aportaciones y devolvía 400 a cualquier slug, así
 * que la pareja se caía entera. Lo que aquí se vigila es que la ficha aguante
 * sola: **ninguna** dirección de Explora se abría por su nombre.
 */

const LUGAR = {
  _id: '6a8451c2756a745fe5e230eb',
  slug: 'rio-jucar-a-su-paso-por-corbera-corbera',
  tipo: 'parque',
  nombre: 'Río Júcar a su paso por Corbera',
  descripcion: 'Tramo de ribera con sombra y acceso al agua.',
  fotos: [],
  ubicacion: { ciudad: 'Corbera', provincia: 'Valencia' },
  atributos: { agua: true },
  ratingPromedio: 4.6,
  totalReviews: 9,
};

test.describe('Explora', () => {
  test('debería abrir la ficha por su dirección legible', async ({ page }) => {
    const pedidas: string[] = [];
    await interceptarApi(page, {
      'GET /lugares/*': (route) => {
        pedidas.push(new URL(route.request().url()).pathname);
        return { cuerpo: LUGAR };
      },
      'GET /lugares/*/reviews': { cuerpo: [] },
    });

    await page.goto(`/explora/${LUGAR.slug}`);

    await expect(page.getByText('Río Júcar a su paso por Corbera').first()).toBeVisible();
    await expect(page.locator('.rs-alert--error')).toHaveCount(0);
    // El API recibe el slug tal cual, sin que la pantalla intente convertirlo.
    expect(pedidas.some((ruta) => ruta.endsWith(LUGAR.slug))).toBe(true);
  });

  /* La ficha manda: sus aportaciones son un extra, no su certificado de vida. */
  test('debería abrirse aunque fallen las aportaciones', async ({ page }) => {
    await interceptarApi(page, {
      'GET /lugares/*': { cuerpo: LUGAR },
      'GET /lugares/*/reviews': { estado: 400, cuerpo: { message: 'Identificador no válido' } },
    });

    await page.goto(`/explora/${LUGAR.slug}`);

    await expect(page.getByText('Río Júcar a su paso por Corbera').first()).toBeVisible();
    await expect(page.locator('.rs-alert--error')).toHaveCount(0);
  });

  /* Los enlaces por id llevan años circulando: siguen abriendo, y se corrigen. */
  test('debería seguir abriendo por id y llevar la barra a la dirección legible', async ({ page }) => {
    await interceptarApi(page, {
      'GET /lugares/*': { cuerpo: LUGAR },
      'GET /lugares/*/reviews': { cuerpo: [] },
    });

    await page.goto(`/explora/${LUGAR._id}`);

    await expect(page.getByText('Río Júcar a su paso por Corbera').first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/explora/${LUGAR.slug}$`));
  });

  /* Un sitio que de verdad no existe sí tiene que decirlo. */
  test('debería avisar cuando el sitio no existe', async ({ page }) => {
    await interceptarApi(page, {
      'GET /lugares/*': { estado: 404, cuerpo: { message: 'Lugar no encontrado' } },
      'GET /lugares/*/reviews': { cuerpo: [] },
    });

    await page.goto('/explora/sitio-que-no-existe');

    await expect(page.locator('.rs-alert--error')).toContainText('No hemos encontrado este sitio');
  });

  test('debería llegar a la ficha desde el listado', async ({ page }) => {
    await interceptarApi(page, {
      'GET /lugares': { cuerpo: [LUGAR] },
      'GET /lugares/*': { cuerpo: LUGAR },
      'GET /lugares/*/reviews': { cuerpo: [] },
    });

    await page.goto('/explora');
    await page.getByRole('link', { name: /Río Júcar a su paso por Corbera/ }).first().click();

    await expect(page).toHaveURL(new RegExp(`/explora/${LUGAR.slug}$`));
    await expect(page.locator('.rs-alert--error')).toHaveCount(0);
  });
});
