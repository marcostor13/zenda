import { test, expect, interceptarApi } from './fixtures/api';

/**
 * Buscar en una población sin servicios: en lugar de "Sin resultados", el
 * listado dice cuál es el más cercano y enseña lo que hay alrededor.
 */

const VILA_CAN = {
  id: 'vila-can', nombre: 'Centro canino Vila-can', ciudad: 'Vila-real', comercioId: 'c1',
  precioPorNoche: 35, score: 9, scoreLabel: 'Excelente', numResenas: 12, imagenes: [], destacado: false,
  distanciaKm: 8.4, extra: {},
};

test.describe('Lo más cercano cuando una población no tiene nada', () => {
  test('debería nombrar el más cercano, enlazar su ficha y marcar la distancia', async ({ page }) => {
    await interceptarApi(page, {
      'GET /catalog/servicios': {
        cuerpo: {
          items: [VILA_CAN], total: 1, page: 1, totalPages: 1,
          cercanos: {
            ciudadBuscada: 'Castellón de la Plana', radioKm: 60,
            masCercano: { id: 'vila-can', nombre: 'Centro canino Vila-can', ciudad: 'Vila-real', distanciaKm: 8.4 },
          },
        },
      },
      'GET /catalog/servicios/facetas': { cuerpo: { precios: [], amenities: [], valoracion: [] } },
      'GET /catalog/servicios/mapa': { cuerpo: [] },
    });

    await page.goto('/veterinaria?ciudad=Castell%C3%B3n');

    const aviso = page.getByTestId('aviso-cercanos');
    await expect(aviso).toContainText('No hay servicios en Castellón de la Plana.');
    await expect(aviso).toContainText('en Vila-real, a 8,4 km.');
    await expect(page.getByText('Vila-real · a 8,4 km').first()).toBeVisible();
    await expect(page.getByText('Sin resultados')).toHaveCount(0);

    await aviso.getByRole('link', { name: 'Centro canino Vila-can' }).click();
    await expect(page).toHaveURL(/\/veterinaria\/vila-can/);
  });
});
