import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * Elegir la cita en una peluquería: el cliente ve las horas libres del día y
 * toca una, en lugar de escribir una hora sin saber cuáles quedan.
 */

const PELUQUERIA = {
  id: 's-pelu', nombre: 'Guau Style', ciudad: 'Valencia', comercioId: 'c-pelu',
  imagenes: [], resenas: [],
  extra: {
    serviciosGrooming: [
      { nombre: 'Baño', precio: 25, duracionMin: 45, tamanoPerro: 'todos' },
      { nombre: 'Corte', precio: 40, duracionMin: 90, tamanoPerro: 'todos' },
    ],
  },
};

const DIA = '2030-09-23';
const hueco = (hora: string, disponible = true) => ({
  hora, disponible, inicio: `${DIA}T${hora}:00+02:00`,
});

const URL_ASISTENTE = `/reservas/peluqueria/s-pelu?comercioId=c-pelu&nombre=Guau%20Style&precioBase=25&checkIn=${DIA}`;

test.describe('Elegir cita', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
  });

  test('debería enseñar las citas libres, no dejar coger una ocupada y usar la elegida', async ({ page }) => {
    const consultas: Array<Record<string, string>> = [];
    const comprobaciones: Array<Record<string, unknown>> = [];

    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos': (route) => {
        consultas.push(Object.fromEntries(new URL(route.request().url()).searchParams));
        return {
          cuerpo: {
            soportado: true, estado: 'abierto', duracionMin: 45,
            huecos: [hueco('09:00'), hueco('09:30', false), hueco('16:00')],
          },
        };
      },
      'POST /reservas/disponibilidad': (route) => {
        comprobaciones.push(route.request().postDataJSON() as Record<string, unknown>);
        return { cuerpo: { disponible: true, precioEstimado: 25 } };
      },
    });

    await page.goto(URL_ASISTENTE);

    const citas = page.getByRole('radiogroup', { name: 'Citas disponibles' });
    await expect(citas.getByRole('radio', { name: '16:00' })).toBeVisible();
    await expect(citas.getByRole('radio', { name: '09:30' })).toBeDisabled();
    await expect(page.getByText('Citas de 45 min.')).toBeVisible();
    // Ni rastro del campo para escribir la hora a mano.
    await expect(page.locator('input[type="time"]')).toHaveCount(0);

    expect(consultas.at(-1)).toMatchObject({ servicioId: 's-pelu', fecha: DIA });

    await citas.getByRole('radio', { name: '16:00' }).click();
    await expect(citas.getByRole('radio', { name: '16:00' })).toHaveAttribute('aria-checked', 'true');

    // La comprobación previa ya va con la cita elegida, a las 16:00 de Madrid.
    await expect
      .poll(() => comprobaciones.find((c) => (c['detalle'] as { hora?: string } | undefined)?.hora === '16:00'), { timeout: 15_000 })
      .toMatchObject({ fechaInicio: `${DIA}T14:00:00.000Z` });
    await expect(page.getByRole('button', { name: /Continuar . Tus datos/i })).toBeEnabled();
  });

  test('debería volver a pedir las citas al cambiar de servicio, porque cambia la duración', async ({ page }) => {
    const servicios: string[] = [];
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos': (route) => {
        servicios.push(new URL(route.request().url()).searchParams.get('servicio') ?? '');
        return { cuerpo: { soportado: true, estado: 'abierto', duracionMin: 45, huecos: [hueco('10:00')] } };
      },
    });

    await page.goto(URL_ASISTENTE);
    await expect(page.getByRole('radio', { name: '10:00' })).toBeVisible();

    await page.locator('select[formcontrolname="servicio"]').selectOption('Corte');

    await expect.poll(() => servicios.at(-1)).toBe('Corte');
  });

  test('debería decir por qué un día no tiene citas', async ({ page }) => {
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos': {
        cuerpo: { soportado: true, estado: 'cerrado', motivo: 'El comercio no atiende ese día de la semana.', huecos: [] },
      },
    });

    await page.goto(URL_ASISTENTE);

    await expect(page.getByTestId('citas-cerrado')).toContainText('no atiende ese día de la semana');
    await expect(page.getByRole('button', { name: /Continuar . Tus datos/i })).toBeDisabled();
  });
});
