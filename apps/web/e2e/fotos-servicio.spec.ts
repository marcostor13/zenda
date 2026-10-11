import type { Page } from '@playwright/test';
import { test, expect, interceptarApi, sesionIniciada, type Rutas } from './fixtures/api';

/**
 * Fotos en el alta de un servicio.
 *
 * Sin el mínimo de fotos la ficha no se publica, así que una subida que no
 * cuenta deja al comercio atascado en el paso de detalles sin saber por qué.
 */

/** JPEG válido de 1x1: suficiente para que el navegador lo trate como foto. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=',
  'base64',
);

const fotos = (cuantas: number) =>
  Array.from({ length: cuantas }, (_, i) => ({ name: `foto-${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: JPEG }));

async function continuar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

/** Deja el alta en el paso de detalles con la categoría pedida. */
async function irADetalles(page: Page, vertical: string): Promise<void> {
  await page.goto('/comercio/listados/nuevo');

  await page.locator('#vertical').selectOption(vertical);
  await page.locator('#titulo').fill('Centro canino Vila-can');
  await page.locator('#descripcion').fill('Instalaciones amplias, personal titulado y atención individual para cada perro.');
  await continuar(page);

  await page.locator('#ciudad').fill('Castellón');
  await page.locator('#precioBase').fill('25');
  await continuar(page);

  await continuar(page);
}

test.describe('Comercio · fotos del servicio', () => {
  test.beforeEach(async ({ page }) => {
    let subidas = 0;
    const rutas: Rutas = {
      'GET /comercios/mi-comercio': {
        cuerpo: { _id: 'c-e2e', nombreComercial: 'VilaCan', verticales: ['peluqueria', 'alojamiento'], estado: 'activo', plan: 'pro' },
      },
      'POST /upload/image': () => ({ estado: 201, cuerpo: { url: `https://fotos.test/${++subidas}.jpg` } }),
    };
    await sesionIniciada(page, { rol: 'comercio_admin' });
    await interceptarApi(page, rutas);
  });

  test('debería contar las fotos subidas a la galería del servicio', async ({ page }) => {
    await irADetalles(page, 'peluqueria');

    const cuenta = page.locator('.fotos-cuenta');
    await expect(cuenta).toContainText('0 de 5 fotos');

    await page.locator('.fotos-servicio input[type="file"]').setInputFiles(fotos(5));

    await expect(page.locator('.fotos-servicio .image-tile__img')).toHaveCount(5);
    await expect(cuenta).toContainText('5 fotos. Ya puedes publicar.');
  });

  test('debería contar las fotos subidas a una unidad de la residencia', async ({ page }) => {
    await irADetalles(page, 'alojamiento');

    await page.locator('.row-card input[type="file"]').first().setInputFiles(fotos(5));

    await expect(page.locator('.fotos-cuenta')).toContainText('5 fotos. Ya puedes publicar.');
  });
});
