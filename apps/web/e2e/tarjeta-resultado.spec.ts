import { test, expect, interceptarApi } from './fixtures/api';

/**
 * La tarjeta de resultado enseña lo mismo en móvil que en escritorio: la
 * distancia al centro, las reseñas, las etiquetas y el botón no dependen del
 * ancho de la pantalla. El proyecto `mobile-chrome` es el que lo vigila.
 */

const CLINICA = {
  id: 'clinica-centro', nombre: 'Clínica veterinaria del Centro', ciudad: 'Valencia', comercioId: 'c1',
  precioPorNoche: 40, score: 4.6, scoreLabel: 'Fabuloso', numResenas: 12,
  imagenes: ['https://fotos.test/clinica.jpg'], destacado: false, distanciaCentroKm: 0.4,
  extra: { atiendeUrgencias: true, especialidades: ['Dermatología', 'Cirugía', 'Cardiología'] },
};

test.describe('Tarjeta de resultado', () => {
  test('debería mostrar la distancia al centro, las reseñas, el precio y el botón', async ({ page }) => {
    await interceptarApi(page, {
      'GET /catalog/servicios': { cuerpo: { items: [CLINICA], total: 1, page: 1, totalPages: 1 } },
      'GET /catalog/servicios/facetas': { cuerpo: { precios: [], amenities: [], valoracion: [] } },
      'GET /catalog/servicios/mapa': { cuerpo: [] },
    });

    await page.goto('/veterinaria?ciudad=Valencia');

    const tarjeta = page.locator('.rs-hotel-card').first();
    await expect(tarjeta.getByText('Valencia · a 0,4 km del centro')).toBeVisible();
    await expect(tarjeta.getByText('Fabuloso')).toBeVisible();
    await expect(tarjeta.getByText('12 reseñas')).toBeVisible();
    await expect(tarjeta.getByText('IVA incluido')).toBeVisible();
    await expect(tarjeta.getByRole('button', { name: 'Reservar' })).toBeVisible();

    // Nada de lo que la tarjeta pinta puede quedar escondido por el ancho.
    const ocultos = await tarjeta.locator('.rs-amenity, .rs-hotel-card__destacados li').evaluateAll(
      (nodos) => nodos.filter((n) => (n as HTMLElement).offsetParent === null).length,
    );
    expect(ocultos).toBe(0);
  });
});
