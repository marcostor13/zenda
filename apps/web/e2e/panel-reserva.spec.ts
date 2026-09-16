import type { Page } from '@playwright/test';
import { test, expect, interceptarApi } from './fixtures/api';

/**
 * El panel de reserva de una ficha a distintas alturas de pantalla.
 *
 * Nace de lo reportado el 2026-09-16: en un escritorio de pantalla corta el
 * panel de la derecha «no se ve completo». Se quedaba pegado midiendo más que
 * el hueco visible, así que su parte de abajo —el botón incluido— caía fuera y
 * la página se desplazaba por detrás sin arrastrarlo. La regla ahora es una: si
 * cabe se pega, y si no cabe acompaña a la página.
 */

const ALOJAMIENTO = {
  id: 'a1', nombre: 'Residencia Vila-can', ciudad: 'Valencia', comercioId: 'c1',
  barrio: '', direccion: 'Calle 1', precioPorNoche: 25, score: 9, scoreLabel: 'Excelente',
  numResenas: 40, imagenes: [], destacado: false, vertical: 'alojamiento',
  amenities: ['Paseos diarios', 'Cámaras 24h'], cancelacionGratis: true,
  descripcion: 'Espacios amplios con patio.', resenas: [], horario: [], excepcionesHorario: [],
  espacios: [
    { id: 'e1', tipo: 'suite', precioNoche: 35, cantidad: 2, disponible: 2, amenities: [], tamanoMaxPerro: 'grande' },
    { id: 'e2', tipo: 'estandar', precioNoche: 25, cantidad: 4, disponible: 4, amenities: [], tamanoMaxPerro: 'mediano' },
  ],
  extra: {},
};

const abrirFicha = async (page: Page) => {
  await interceptarApi(page, { 'GET /catalog/servicios/*': { cuerpo: ALOJAMIENTO } });
  await page.goto('/alojamiento/a1');
  await expect(page.getByRole('heading', { name: 'Residencia Vila-can' }).first()).toBeVisible();
};

/** Alto real del panel con este contenido; de ahí salen las ventanas a probar. */
const altoDelPanel = async (page: Page) =>
  Math.round((await page.locator('.booking-panel').boundingBox())!.height);

/** Lo que ocupa la cabecera pegada más la holgura que exige la directiva. */
const RESERVADO = 84 + 16;

test.describe('Panel de reserva de la ficha', () => {
  /*
   * Las alturas se derivan del panel medido, no de un número escrito a mano:
   * el panel crece o mengua con su contenido —el aviso de escasez, el mapa— y
   * una cifra fija haría que la prueba dijera cosas distintas según la ficha.
   */
  test('no debería quedarse pegado cuando no cabe, para poder leerlo entero', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1400 });
    await abrirFicha(page);
    const alto = await altoDelPanel(page);

    // Una ventana del alto justo del panel: con la cabecera por medio, no cabe.
    await page.setViewportSize({ width: 1440, height: alto });

    const panel = page.locator('.booking-panel');
    await expect(panel).toHaveCSS('position', 'static');

    // Y se llega al botón bajando, que es lo que antes no pasaba.
    const boton = page.locator('.booking-panel__card .rs-btn--gold');
    await boton.scrollIntoViewIfNeeded();
    await expect(boton).toBeInViewport();
  });

  test('debería quedarse pegado cuando la pantalla da de sí', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1400 });
    await abrirFicha(page);
    const alto = await altoDelPanel(page);

    await page.setViewportSize({ width: 1440, height: alto + RESERVADO + 40 });

    await expect(page.locator('.booking-panel')).toHaveCSS('position', 'sticky');
  });

  /* Estirar o encoger la ventana lo recalcula sin recargar. */
  test('debería recalcularse al cambiar el alto de la ventana', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1400 });
    await abrirFicha(page);
    const alto = await altoDelPanel(page);
    const panel = page.locator('.booking-panel');

    await page.setViewportSize({ width: 1440, height: alto });
    await expect(panel).toHaveCSS('position', 'static');

    await page.setViewportSize({ width: 1440, height: alto + RESERVADO + 40 });
    await expect(panel).toHaveCSS('position', 'sticky');
  });

  /*
   * La regla, a cualquier altura y sin saber cuánto mide el panel: o está
   * pegado y se ve entero, o no está pegado. Pegado y recortado —lo que se
   * reportó— no es una combinación admisible en ninguna resolución.
   */
  for (const height of [600, 700, 760, 800, 900, 1080, 1440]) {
    test(`debería estar pegado sólo si cabe, a ${height} px de alto`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height });
      await abrirFicha(page);

      const panel = page.locator('.booking-panel');
      /*
       * Se mide el alto, no la posición: al cargar, el panel todavía está en su
       * sitio natural y puede asomar por debajo del pliegue sin que eso sea el
       * fallo. Pegado sólo es correcto si el panel entero cabe en el hueco que
       * queda bajo la cabecera, porque es ahí donde se quedará.
       */
      const estado = await panel.evaluate((el) => ({
        pegado: getComputedStyle(el).position === 'sticky',
        alto: el.getBoundingClientRect().height,
        hueco: window.innerHeight - 84,
      }));

      if (estado.pegado) expect(estado.alto).toBeLessThanOrEqual(estado.hueco);

      // Ni tope de alto ni barra propia: lo que no cabe se alcanza bajando.
      const recorta = await panel.evaluate((el) => {
        const cs = getComputedStyle(el);
        return cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.maxHeight !== 'none';
      });
      expect(recorta).toBe(false);

      const boton = page.locator('.booking-panel__card .rs-btn--gold');
      await boton.scrollIntoViewIfNeeded();
      await expect(boton).toBeInViewport();
    });
  }

  test('debería llamar "Reservar" al botón, con espacio elegido y sin él', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await abrirFicha(page);

    const boton = page.locator('.booking-panel__card .rs-btn--gold');
    await expect(boton).toHaveText(/Reservar/);

    await page.getByRole('button', { name: 'Seleccionar', exact: true }).first().click();

    await expect(boton).toHaveText(/Reservar/);
  });
});
