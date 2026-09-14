import type { Page, Route } from '@playwright/test';
import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * Elegir el **día** de la cita sobre un calendario que ya sabe qué días hay.
 *
 * Hasta ahora el paso 1 era un `input type="date"` a ciegas: el cliente
 * escribía una fecha y sólo al cargar las horas descubría que el salón cerraba
 * ese día o que estaba lleno, así que iba probando fechas hasta acertar. Lo que
 * se comprueba aquí es que eso ya no pasa: los días que no valen llegan
 * apagados y el primero libre viene elegido de antemano.
 */

const PELUQUERIA = {
  id: 's-pelu', nombre: 'Guau Style', ciudad: 'Valencia', comercioId: 'c-pelu',
  imagenes: [], resenas: [],
  extra: {
    serviciosGrooming: [{ nombre: 'Baño', precio: 25, duracionMin: 45, tamanoPerro: 'todos' }],
  },
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const sumarDias = (fecha: string, dias: number): string =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);

const numeroDeDia = (fecha: string): number => Number(fecha.slice(8, 10));

/**
 * La celda de un día del calendario. Se busca por su texto y no por el nombre
 * accesible: ese es el `aria-label` completo ("17 de septiembre de 2026"), que
 * obligaría a componer el mes en castellano dentro de la prueba.
 */
const celdaDelDia = (page: Page, numero: number) =>
  page.locator(`.cal__rejilla button.cal__dia:text-is("${numero}")`);

/**
 * Agenda calculada sobre el rango que pida el componente, en vez de fechas
 * fijas: el calendario abre por el mes en curso, así que un mes escrito a mano
 * en la prueba dejaría de coincidir en cuanto pasara el tiempo.
 *
 * Primer día cerrado, segundo lleno y el resto libres: los tres estados que el
 * cliente tiene que distinguir de un vistazo.
 */
function agendaDelRango(route: Route) {
  const desde = new URL(route.request().url()).searchParams.get('desde')!;
  return {
    cuerpo: {
      soportado: true,
      duracionMin: 45,
      dias: [
        { fecha: desde, estado: 'cerrado', huecosLibres: 0, motivo: 'El comercio no atiende ese día de la semana.' },
        { fecha: sumarDias(desde, 1), estado: 'completo', huecosLibres: 0 },
        { fecha: sumarDias(desde, 2), estado: 'libre', huecosLibres: 4, primeraHora: '10:00' },
        { fecha: sumarDias(desde, 3), estado: 'libre', huecosLibres: 2, primeraHora: '09:00' },
      ],
      primeraLibre: { fecha: sumarDias(desde, 2), hora: '10:00' },
    },
  };
}

const huecosDe = (fecha: string) => ({
  soportado: true, estado: 'abierto', duracionMin: 45,
  huecos: [
    { hora: '10:00', inicio: `${fecha}T10:00:00+02:00`, disponible: true },
    { hora: '10:30', inicio: `${fecha}T10:30:00+02:00`, disponible: true },
  ],
});

/** Sin `checkIn`: es el caso real de quien entra a pedir cita sin fecha en mente. */
const URL_ASISTENTE = '/reservas/peluqueria/s-pelu?comercioId=c-pelu&nombre=Guau%20Style&precioBase=25';

/**
 * El mes siguiente siempre tiene sus 28 días por delante, así que los cuatro
 * días de la agenda caben enteros. En el mes en curso, según el día que sea,
 * podrían no quedar.
 */
const primeroDelMesQueViene = (): string => {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};

test.describe('Elegir día de la cita', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
  });

  test('debería traer elegido el primer día libre y apagar los que no valen', async ({ page }) => {
    const rangos: Array<Record<string, string>> = [];

    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos/agenda': (route) => {
        rangos.push(Object.fromEntries(new URL(route.request().url()).searchParams));
        return agendaDelRango(route);
      },
      'GET /reservas/huecos': (route) => {
        const fecha = new URL(route.request().url()).searchParams.get('fecha') ?? '';
        return { cuerpo: huecosDe(fecha) };
      },
    });

    await page.goto(URL_ASISTENTE);

    // Ni rastro del campo donde se escribía la fecha a ciegas.
    await expect(page.locator('input[type="date"]')).toHaveCount(0);

    // El atajo contesta a «¿cuándo puedo?» antes de tocar el calendario, y el
    // día ya viene elegido con sus horas cargadas: sin pantalla en blanco.
    await expect(page.getByTestId('atajo-primera-cita')).toContainText('10:00');
    await expect(page.getByTestId('resumen-dia')).toContainText('4 citas libres');
    await expect(page.getByRole('radio', { name: '10:00' })).toBeVisible();

    // Se pide el mes entero de una vez, no día a día: es lo que deja el
    // calendario resuelto con una consulta en vez de una por casilla.
    expect(rangos.every((r) => r['desde'] !== r['hasta'])).toBe(true);
    expect(rangos.at(-1)).toMatchObject({ servicioId: 's-pelu', servicio: 'Baño' });

    // Al mes siguiente, donde los cuatro días de la agenda caben enteros.
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    const primero = primeroDelMesQueViene();
    await expect.poll(() => rangos.at(-1)?.['desde']).toBe(primero);

    const dia = (salto: number) => celdaDelDia(page, numeroDeDia(sumarDias(primero, salto)));

    // Lo cerrado y lo lleno no se pueden ni pulsar; lo libre, sí.
    await expect(dia(0)).toBeDisabled();
    await expect(dia(1)).toBeDisabled();
    await expect(dia(3)).toBeEnabled();
  });

  test('debería cambiar de día con un toque y recargar sus horas', async ({ page }) => {
    const diasPedidos: string[] = [];

    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos/agenda': agendaDelRango,
      'GET /reservas/huecos': (route) => {
        const fecha = new URL(route.request().url()).searchParams.get('fecha') ?? '';
        diasPedidos.push(fecha);
        return { cuerpo: huecosDe(fecha) };
      },
    });

    await page.goto(URL_ASISTENTE);
    await expect(page.getByTestId('resumen-dia')).toContainText('4 citas libres');

    await page.getByRole('button', { name: 'Mes siguiente' }).click();
    const primero = primeroDelMesQueViene();
    const cuarto = sumarDias(primero, 3);
    await expect(page.locator('.cal__rejilla')).toBeVisible();

    await celdaDelDia(page, numeroDeDia(cuarto)).click();

    await expect(page.getByTestId('resumen-dia')).toContainText('2 citas libres');
    await expect.poll(() => diasPedidos.at(-1)).toBe(cuarto);
  });

  test('debería avisar si el mes entero se queda sin citas', async ({ page }) => {
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos/agenda': (route) => {
        const desde = new URL(route.request().url()).searchParams.get('desde')!;
        return {
          cuerpo: {
            soportado: true,
            duracionMin: 45,
            dias: [
              { fecha: desde, estado: 'completo', huecosLibres: 0 },
              { fecha: sumarDias(desde, 1), estado: 'cerrado', huecosLibres: 0, motivo: 'Vacaciones' },
            ],
          },
        };
      },
    });

    await page.goto(URL_ASISTENTE);

    await expect(page.getByTestId('mes-sin-citas')).toContainText('Prueba con el siguiente');
  });
});
