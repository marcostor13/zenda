import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * La ficha del comercio como la ve el cliente: lo primero que tiene que poder
 * hacer es reservar.
 *
 * Antes el sitio de honor de la columna lo ocupaban las ocho líneas de la
 * garantía —idénticas en toda la web— y los servicios se pintaban como
 * etiquetas sueltas: sin precio, sin duración y sin forma de reservar uno
 * concreto. El precio vivía en un panel que decía "Desde 25 € desde" y no
 * había manera de saber si quedaba hueco sin entrar al asistente.
 */

const PELUQUERIA = {
  id: 's-pelu', nombre: 'Guau Style', ciudad: 'Valencia', comercioId: 'c-pelu',
  barrio: 'Ruzafa', direccion: 'Carrer de Sueca 12',
  precioPorNoche: 25, score: 4.7, scoreLabel: 'Excelente', numResenas: 128,
  imagenes: [], destacado: false, amenities: [], cancelacionGratis: true,
  descripcion: 'Salón de peluquería canina.', horario: [], excepcionesHorario: [],
  resenas: [
    { id: 'r1', autorNombre: 'Ana', puntuacion: 5, comentario: 'Genial', fecha: '2026-08-01',
      aspectos: { resultado: 5, tratoAlPerro: 4, puntualidad: 5 } },
  ],
  extra: {
    serviciosGrooming: [
      { nombre: 'Baño e higiene', precio: 25, duracionMin: 45 },
      { nombre: 'Corte de pelo', precio: 40, duracionMin: 90 },
    ],
  },
};

const AGENDA = {
  soportado: true, duracionMin: 45,
  dias: [{ fecha: '2030-09-16', estado: 'libre', huecosLibres: 4, primeraHora: '10:00' }],
  primeraLibre: { fecha: '2030-09-16', hora: '10:00' },
};

test.describe('Ficha de un comercio', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos/agenda': { cuerpo: AGENDA },
    });
  });

  test('debería poner delante lo que decide la reserva: servicio, precio y cuándo hay hueco', async ({ page }) => {
    await page.goto('/peluqueria/s-pelu');

    // Cada servicio con su precio y su duración, no una etiqueta suelta.
    const tarifas = page.getByTestId('tarifas');
    await expect(tarifas.getByText('Corte de pelo')).toBeVisible();
    await expect(tarifas.getByText('40 €')).toBeVisible();
    await expect(tarifas.getByText('1 h 30 min')).toBeVisible();

    // La respuesta a "¿cuándo puedo?", sin entrar al asistente.
    await expect(page.getByTestId('proxima-cita')).toContainText('10:00');

    // La garantía, una sola vez.
    await expect(page.locator('rs-trust-block')).toHaveCount(1);

    // Y sin el "Desde … desde" que arrastraba el panel de peluquería.
    await expect(page.locator('.side-panel')).not.toContainText('desde');
  });

  test('debería llevar al asistente con el servicio elegido en la ficha', async ({ page }) => {
    await page.goto('/peluqueria/s-pelu');

    await page.getByTestId('tarifas').getByRole('button', { name: 'Reservar' }).nth(1).click();

    await expect(page).toHaveURL(/\/reservas\/peluqueria\/s-pelu/);
    await expect(page).toHaveURL(/servicio=Corte\+de\+pelo|servicio=Corte%20de%20pelo/);
    // El paso 1 abre con ese servicio ya puesto: no hay que volver a buscarlo.
    await expect(page.locator('select[formcontrolname="servicio"]')).toHaveValue('Corte de pelo');
  });

  test('debería dejar la acción de reservar siempre a la vista en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/peluqueria/s-pelu');

    const barra = page.locator('.mobile-cta');
    await expect(barra.getByRole('button', { name: 'Reservar cita' })).toBeInViewport();

    // Sin bajar nada: la acción está desde el primer momento.
    await page.mouse.wheel(0, 4000);
    await expect(barra.getByRole('button', { name: 'Reservar cita' })).toBeInViewport();
  });
});
