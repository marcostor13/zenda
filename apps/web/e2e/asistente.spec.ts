import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * El asistente de la web: un flotante abajo a la izquierda que resuelve dudas
 * sobre Doogking y guía por sus procedimientos.
 *
 * Va a la izquierda porque la derecha es de la acción que da dinero —el panel
 * de reserva de las fichas—, y en reposo es un círculo de 52 px: un flotante
 * permanente sólo se perdona si casi no está.
 */

const RESPUESTA = {
  disponible: true,
  respuesta: 'Para reservar:\n1. Abre la ficha.\n2. Elige el servicio.\n3. Escoge día y hora.',
  enlaces: [{ titulo: 'Ver peluquerías', ruta: '/peluqueria' }],
};

test.describe('Asistente de la web', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('debería responder una duda y proponer a dónde ir', async ({ page }) => {
    const consultas: Array<Record<string, unknown>> = [];
    await interceptarApi(page, {
      'POST /asistente': (route) => {
        consultas.push(route.request().postDataJSON() as Record<string, unknown>);
        return { cuerpo: RESPUESTA };
      },
    });
    await page.goto('/');

    await page.getByTestId('lanzador-asistente').click();
    const panel = page.getByTestId('panel-asistente');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Soy el asistente de Doogking');

    await panel.getByRole('button', { name: '¿Cómo reservo una cita?' }).click();

    await expect(panel).toContainText('Escoge día y hora');
    await expect(panel.getByRole('link', { name: /Ver peluquerías/ })).toBeVisible();

    // Se le manda la página donde está el usuario, para que entienda "esto".
    expect(consultas[0]).toMatchObject({ pregunta: '¿Cómo reservo una cita?', ruta: '/' });
  });

  test('debería mantener el hilo entre preguntas', async ({ page }) => {
    const consultas: Array<Record<string, unknown>> = [];
    await interceptarApi(page, {
      'POST /asistente': (route) => {
        consultas.push(route.request().postDataJSON() as Record<string, unknown>);
        return { cuerpo: { disponible: true, respuesta: 'Ahí va.' } };
      },
    });
    await page.goto('/');
    await page.getByTestId('lanzador-asistente').click();

    const campo = page.getByLabel('Tu pregunta');
    await campo.fill('¿Cómo reservo?');
    await campo.press('Enter');
    await expect(page.getByTestId('hilo-asistente')).toContainText('Ahí va.');

    await campo.fill('¿Y cancelarla?');
    await campo.press('Enter');
    await expect.poll(() => consultas.length).toBe(2);

    expect(consultas[1]['historial']).toEqual([
      { autor: 'cliente', texto: '¿Cómo reservo?' },
      { autor: 'asistente', texto: 'Ahí va.' },
    ]);
  });

  /* Lo que el encargo pedía: que no tape nada. */
  test('no debería tapar la acción de reservar de una ficha', async ({ page }) => {
    await interceptarApi(page, {
      'POST /asistente': { cuerpo: RESPUESTA },
      'GET /catalog/servicios/*': {
        cuerpo: {
          id: 's1', nombre: 'Guau Style', ciudad: 'Valencia', comercioId: 'c1',
          barrio: '', direccion: 'Calle 1', precioPorNoche: 25, score: 5, scoreLabel: 'Excelente',
          numResenas: 2, imagenes: [], destacado: false, vertical: 'peluqueria',
          amenities: [], cancelacionGratis: true, descripcion: '', resenas: [],
          horario: [], excepcionesHorario: [], extra: {},
        },
      },
    });
    await page.goto('/peluqueria/s1');

    const lanzador = (await page.getByTestId('lanzador-asistente').boundingBox())!;
    const cta = (await page.locator('.side-panel .rs-btn--gold').boundingBox())!;

    // En reposo es un círculo pequeño, y a la izquierda del panel de reserva.
    expect(Math.round(lanzador.width)).toBeLessThanOrEqual(56);
    expect(lanzador.x + lanzador.width).toBeLessThan(cta.x);
  });

  /* Abajo la pantalla ya es de la barra de reservar y de la app instalada. */
  test('no debería aparecer en móvil', async ({ page }) => {
    await interceptarApi(page, { 'POST /asistente': { cuerpo: RESPUESTA } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByTestId('lanzador-asistente')).toBeHidden();
  });
});
