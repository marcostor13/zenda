import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * Horas de las citas vistas desde fuera de España.
 *
 * El navegador está en Lima (UTC−5) a propósito: es donde se detectó que la
 * agenda y las reservas enseñaban horas y días desplazados. Una cita a las
 * 10:00 de Madrid tiene que salir a las 10:00 lo mire quien lo mire, porque es
 * la hora a la que el perro tiene que estar en la clínica.
 */
test.use({ timezoneId: 'America/Lima' });

// Lunes 21 de septiembre de 2026, 10:00–10:30 en Madrid (08:00Z–08:30Z).
const CITA = {
  _id: 'r1', codigo: 'RES-CITA1', servicioId: 's1', estado: 'confirmada',
  cliente: 'Ana Ruiz', perro: 'Nala',
  desde: '2026-09-21T08:00:00.000Z', hasta: '2026-09-21T08:30:00.000Z',
};

const SERVICIO = {
  _id: 's1', titulo: 'Consulta general', vertical: 'veterinaria', estado: 'publicado',
  precioBase: 40, imagenes: [], ciudad: 'Valencia',
};

test.describe('Horas de Madrid con el navegador en otra zona', () => {
  test.beforeEach(async ({ page }) => {
    // El lunes de la cita a media mañana en Madrid: la agenda abre esa semana.
    await page.clock.setFixedTime(new Date('2026-09-21T09:00:00.000Z'));
    await sesionIniciada(page, { nombre: 'Dra. Pérez', email: 'vet@royal.com', rol: 'comercio_admin' });
  });

  test('la agenda del comercio sitúa la cita en la fila de las 10:00 y con media hora de alto', async ({ page }) => {
    await interceptarApi(page, {
      'GET /comercios/mi-comercio': { cuerpo: { _id: 'c1', nombreComercial: 'Clínica Royal', verticales: ['veterinaria'], estado: 'activo' } },
      'GET /comercios/mis-servicios': { cuerpo: [SERVICIO] },
      'GET /mi-agenda/bloqueos': { cuerpo: [] },
      'GET /mi-agenda/citas': { cuerpo: [CITA] },
    });

    await page.goto('/comercio/agenda');

    const tarjeta = page.locator('button.cita', { hasText: 'Ana Ruiz · Nala' });
    await expect(tarjeta).toBeVisible();
    // La rejilla empieza a las 7:00 y cada hora mide 44 px: las 10:00 quedan a 132 px.
    await expect(tarjeta).toHaveCSS('top', '132px');
    await expect(tarjeta).toHaveCSS('height', '22px');

    // Y cae en la columna del lunes 21, no del domingo 20.
    const lunes = page.locator('.sem-dia', { has: page.locator('.sem-dia__num', { hasText: /^21$/ }) });
    await expect(lunes.locator('button.cita')).toHaveCount(1);
  });

  test('la agenda pide la semana desde la medianoche de Madrid', async ({ page }) => {
    let consultado: URL | null = null;
    await interceptarApi(page, {
      'GET /comercios/mi-comercio': { cuerpo: { _id: 'c1', nombreComercial: 'Clínica Royal', verticales: ['veterinaria'], estado: 'activo' } },
      'GET /comercios/mis-servicios': { cuerpo: [SERVICIO] },
      'GET /mi-agenda/bloqueos': { cuerpo: [] },
      'GET /mi-agenda/citas': (route) => {
        consultado = new URL(route.request().url());
        return { cuerpo: [] };
      },
    });

    await page.goto('/comercio/agenda');
    await expect.poll(() => consultado).not.toBeNull();

    // Lunes 21 a las 00:00 en Madrid son las 22:00 UTC del domingo.
    expect(consultado!.searchParams.get('desde')).toBe('2026-09-20T22:00:00.000Z');
    expect(consultado!.searchParams.get('hasta')).toBe('2026-09-27T22:00:00.000Z');
  });

  test('la lista de reservas del comercio enseña el día y la hora de Madrid', async ({ page }) => {
    await interceptarApi(page, {
      'GET /comercios/mi-comercio': { cuerpo: { _id: 'c1', nombreComercial: 'Clínica Royal', verticales: ['veterinaria'], estado: 'activo' } },
      'GET /comercios/mis-reservas': {
        cuerpo: [{
          _id: 'r1', codigo: 'RES-CITA1', vertical: 'veterinaria', estado: 'confirmada',
          fechaInicio: '2026-09-21T08:00:00.000Z', fechaFin: '2026-09-21T08:30:00.000Z',
          montoTotal: 40, createdAt: '2026-09-20T23:30:00.000Z', clienteNombre: 'Ana Ruiz', perroNombre: 'Nala',
          servicioTitulo: 'Consulta general', detalle: { hora: '10:00' }, suplementos: [],
        }],
      },
    });

    await page.goto('/comercio/reservas');

    const tarjeta = page.locator('.reserva-card', { hasText: 'RES-CITA1' }).first();
    await expect(tarjeta).toContainText('21 sept 2026');
    await expect(tarjeta).toContainText('10:00');
    await expect(tarjeta).not.toContainText('03:00');
  });
});
