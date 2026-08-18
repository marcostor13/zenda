import { test, expect, interceptarApi } from './fixtures/api';

/**
 * Humo: la aplicación arranca, pinta la portada y navega. Si esta prueba falla,
 * el resto de la suite E2E no significa nada, así que se mantiene deliberadamente
 * simple y sin dependencias de datos.
 */
test.describe('Portada', () => {
  test.beforeEach(async ({ page }) => {
    await interceptarApi(page);
  });

  test('debería cargar la portada con su titular y las categorías', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.hero__title')).toContainText(/todo para tu mascota/i);
    await expect(page.locator('.hero__title')).toContainText(/en un solo lugar/i);

    // Ocho categorías + el acceso a "más servicios".
    await expect(page.locator('.sb__cat-icon')).toHaveCount(9);
  });

  test('debería explicar la propuesta de valor con tres bloques', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#por-que h2')).toContainText('¿Por qué Doogking.com?');
    await expect(page.locator('.why-card')).toHaveCount(3);
  });

  test('debería navegar de la portada al listado de una categoría', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /veterinari/i }).first().click();

    await expect(page).toHaveURL(/\/veterinaria/);
  });

  test('no debería dejar errores de JavaScript en consola al cargar', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await page.goto('/');
    await expect(page.locator('.hero__title')).toBeVisible();

    expect(errores).toEqual([]);
  });
});
