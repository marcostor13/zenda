import type { Page } from '@playwright/test';
import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * Cabecera de una cuenta de comercio. Como en el panel de socios de Booking,
 * es la del negocio: nada de mascotas, reservas propias ni favoritos.
 */

const COMERCIO = { _id: 'c1', nombreComercial: 'Centro canino Vila-can', verticales: ['peluqueria'], estado: 'activo', plan: 'pro' };
const OPCIONES_DE_CLIENTE = ['Mi perfil', 'Mis mascotas', 'Mis reservas', 'Favoritos'];
const CAPTURAS = process.env['CAPTURAS_E2E'];

/** El clic puede llegar antes de que la página hidrate: se repite hasta que abre. */
async function abrirDesplegable(page: Page): Promise<void> {
  const desplegable = page.locator('.rs-navbar__dropdown');
  await expect(async () => {
    if (!(await desplegable.isVisible())) await page.getByRole('button', { name: /Mi negocio/ }).click();
    await expect(desplegable).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

test.describe('Cabecera de la cuenta de comercio', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page, { nombre: 'Marta Gil', email: 'marta@vilacan.es', rol: 'comercio_admin' });
    await interceptarApi(page, {
      'GET /comercios/mi-comercio': { cuerpo: COMERCIO },
      'GET /comercios/mis-reservas': { cuerpo: [] },
      'GET /comercios/mis-servicios': { cuerpo: [] },
    });
  });

  test('debería ofrecer sólo la gestión del negocio dentro del panel', async ({ page, isMobile }) => {
    await page.goto('/comercio');
    await expect(page.getByTestId('zona-comercios')).toBeVisible();

    if (isMobile) {
      const menu = page.locator('.rs-mobile-menu');
      // El clic puede llegar antes de que la página hidrate: se repite hasta que abre.
      await expect(async () => {
        if (!(await menu.isVisible())) await page.locator('.rs-navbar__hamburger').click();
        await expect(menu).toBeVisible({ timeout: 1_000 });
      }).toPass();
      await expect(menu.getByRole('link', { name: 'Ver la web pública' })).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Seguridad y acceso' })).toBeVisible();
      for (const opcion of OPCIONES_DE_CLIENTE) {
        await expect(menu.getByRole('link', { name: opcion, exact: true })).toHaveCount(0);
      }
    } else {
      const desplegable = page.locator('.rs-navbar__dropdown');
      await abrirDesplegable(page);
      await expect(desplegable).toContainText('Centro canino Vila-can');
      await expect(desplegable.getByRole('link', { name: 'Datos del negocio' })).toBeVisible();
      for (const opcion of OPCIONES_DE_CLIENTE) {
        await expect(desplegable.getByRole('link', { name: opcion })).toHaveCount(0);
      }
    }

    if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/cabecera-comercio-${isMobile ? 'movil' : 'escritorio'}.png` });
  });

  for (const pagina of ['/perros', '/favoritos', '/reservas/mis-reservas', '/reservas/peluqueria/s1', '/perfil/alpha']) {
    test(`debería llevar a su panel si abre ${pagina}, que es de cliente`, async ({ page }) => {
      await page.goto(pagina);

      await expect(page).toHaveURL(/\/comercio$/);
    });
  }

  test('debería llevar al panel desde la web pública', async ({ page, isMobile }) => {
    await page.goto('/veterinaria');

    if (isMobile) {
      await expect(page.locator('.rs-navbar__cuenta')).toHaveAttribute('href', '/comercio');
    } else {
      await expect(page.getByRole('link', { name: 'Panel de mi comercio' })).toBeVisible();
      await abrirDesplegable(page);
      await expect(page.locator('.rs-navbar__dropdown').getByRole('link', { name: 'Mis mascotas' })).toHaveCount(0);
    }
  });
});
