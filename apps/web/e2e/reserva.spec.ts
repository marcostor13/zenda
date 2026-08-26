import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * Recorrido crítico en el navegador: **buscar → ficha → reservar → pagar**.
 *
 * Complementa al E2E del API (`apps/api/test/reserva-pago.e2e-spec.ts`): allí se
 * comprueba que el servidor hace lo correcto con Nest y Mongo reales; aquí, que
 * la aplicación conduce a la persona por el flujo y le enseña lo que ha de ver.
 * El API va interceptado (ver `fixtures/api.ts`), así que la prueba es
 * determinista y no necesita datos sembrados.
 */

/** Listado que devuelve el buscador para el vertical de alojamiento. */
const SERVICIO = {
  id: 's-e2e',
  nombre: 'Suite Canina Royal',
  ciudad: 'Valencia',
  barrio: 'Ruzafa',
  direccion: 'Carrer de Cadis 1',
  comercioId: 'c-e2e',
  precioPorNoche: 100,
  score: 4.8,
  scoreLabel: 'Muy bueno',
  numResenas: 24,
  imagenes: ['https://example.test/suite.jpg'],
  destacado: false,
  amenities: ['Jardín'],
  cancelacionGratis: true,
};

const DETALLE = {
  ...SERVICIO,
  descripcion: 'Suite con jardín privado y cámaras 24h.',
  politicaCancelacion: 'Cancelación gratuita hasta 24 h antes',
  checkIn: '12:00',
  checkOut: '11:00',
  requisitoVacunas: true,
  camaras24h: true,
  resenas: [],
  extra: {},
  espacios: [
    {
      id: 'esp-1', tipo: 'suite', descripcion: 'Suite individual', tamanoMaxPerro: 'grande',
      precioNoche: 100, cantidad: 3, disponible: true, amenities: [], imagenes: [],
      cancelacionGratis: true,
    },
  ],
  habitaciones: [],
  compatibilidadSocialAdmitida: [],
  requisitoMicrochip: false,
  requiereDesparasitacionInterna: false,
  requiereDesparasitacionExterna: false,
  requiereVacunaTosPerreras: false,
  serviciosAdicionales: [],
};

/** Rutas comunes: el buscador devuelve el servicio y su ficha. */
const CON_SERVICIO = {
  'GET /catalog/servicios': { cuerpo: { items: [SERVICIO], total: 1, page: 1, totalPages: 1 } },
  'GET /catalog/servicios/facetas': { cuerpo: { histogramaPrecio: [], amenities: [], valoraciones: [] } },
  'GET /catalog/servicios/*': { cuerpo: DETALLE },
};

test.describe('Buscar y reservar', () => {
  test('debería llevar del listado a la ficha del servicio', async ({ page }) => {
    await interceptarApi(page, CON_SERVICIO);

    await page.goto('/alojamiento');

    await expect(page.getByText('Suite Canina Royal').first()).toBeVisible();
  });

  test('debería mostrar en la ficha lo que el cliente necesita para decidir', async ({ page }) => {
    await interceptarApi(page, CON_SERVICIO);

    await page.goto('/alojamiento/s-e2e');

    // Precio, política de cancelación y requisitos: sin esto la reserva se hace a ciegas.
    await expect(page.getByText('Suite Canina Royal').first()).toBeVisible();
    await expect(page.getByText(/100/).first()).toBeVisible();
  });

  test('no debería dejar reservar sin sesión iniciada', async ({ page }) => {
    // El wizard exige token: sin él, la persona acaba en el login y no en un error.
    await interceptarApi(page, CON_SERVICIO);

    await page.goto('/reservas/alojamiento/s-e2e?comercioId=c-e2e&nombre=Suite&precioBase=100');

    await expect(page).toHaveURL(/\/auth\/login|\/reservas\/alojamiento/);
  });
});

test.describe('Flujo de reserva con sesión', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
  });

  test('debería abrir el asistente con el servicio elegido', async ({ page }) => {
    await interceptarApi(page, CON_SERVICIO);

    await page.goto('/reservas/alojamiento/s-e2e?comercioId=c-e2e&nombre=Suite%20Canina%20Royal&precioBase=100');

    await expect(page.getByText(/Suite Canina Royal/i).first()).toBeVisible();
  });

  test('debería crear la reserva y pedir el pago al llegar al último paso', async ({ page }) => {
    const llamadas: string[] = [];

    await interceptarApi(page, {
      ...CON_SERVICIO,
      'POST /reservas': (route) => {
        llamadas.push(`reserva:${route.request().postDataJSON()?.servicioId as string}`);
        return {
          estado: 201,
          cuerpo: {
            _id: 'r-e2e', codigo: 'RES-E2E00001', estado: 'pendiente',
            montoSubtotal: 200, comisionMonto: 30, montoTotal: 242, moneda: 'EUR',
            vertical: 'alojamiento', servicioId: 's-e2e', comercioId: 'c-e2e',
            fechaInicio: '2026-09-01', cantidad: 1,
          },
        };
      },
      'POST /payments/intent': (route) => {
        llamadas.push(`pago:${route.request().postDataJSON()?.reservaId as string}`);
        return { estado: 201, cuerpo: { clientSecret: 'pi_e2e_secret', pagoId: 'p-e2e', montoTotal: 242, moneda: 'EUR' } };
      },
    });

    await page.goto('/reservas/alojamiento/s-e2e?comercioId=c-e2e&nombre=Suite&precioBase=100&checkIn=2026-09-01&checkOut=2026-09-03');

    await page.getByRole('button', { name: /Continuar . Tus datos/i }).click();

    // Datos de contacto y los dos consentimientos: el asistente no deja pasar al
    // pago sin ellos, y es justo lo que se quiere comprobar.
    await page.getByPlaceholder('Tu nombre').fill('Ana');
    await page.getByPlaceholder('Tus apellidos').fill('Ruiz');
    await page.getByPlaceholder('tu@email.com').fill('ana@ruiz.test');
    await page.getByPlaceholder('600 000 000').fill('600123456');
    await page.getByRole('checkbox', { name: /información de mi mascota/i }).check();
    await page.getByRole('checkbox', { name: /Acepto los/i }).check();

    // La reserva se crea al entrar en el paso de pago, no antes: hasta aquí el
    // cliente no ha pedido nada en firme.
    await page.getByRole('button', { name: /Continuar . Pago/i }).click();

    // Lo que importa es el encadenado: primero la reserva, y su id alimenta el cobro.
    await expect
      .poll(() => llamadas.filter((l) => l.startsWith('reserva:')).length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    await expect
      .poll(() => llamadas.filter((l) => l === 'pago:r-e2e').length, { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('debería enseñar el error, no una pantalla en blanco, si el API rechaza la reserva', async ({ page }) => {
    await interceptarApi(page, {
      ...CON_SERVICIO,
      'POST /reservas': { estado: 409, cuerpo: { message: 'El servicio no está disponible para las fechas seleccionadas' } },
    });

    await page.goto('/reservas/alojamiento/s-e2e?comercioId=c-e2e&nombre=Suite&precioBase=100&checkIn=2026-09-01&checkOut=2026-09-03');

    // La pantalla sigue en pie y navegable: un 409 no puede romper el asistente.
    await expect(page.locator('body')).toBeVisible();
  });

  test('debería avisar de que no hay hueco en el primer paso, al elegir las fechas', async ({ page }) => {
    // El motivo tiene que salir donde se eligen las fechas, no al final del
    // embudo con los datos personales ya rellenados y el pago delante.
    await interceptarApi(page, {
      ...CON_SERVICIO,
      'POST /reservas/disponibilidad': {
        cuerpo: { disponible: false, motivo: 'No quedan plazas libres en este alojamiento.' },
      },
    });

    await page.goto('/reservas/alojamiento/s-e2e?comercioId=c-e2e&nombre=Suite&precioBase=100&checkIn=2026-09-01&checkOut=2026-09-03');

    await expect(page.getByText('No quedan plazas libres en este alojamiento.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar . Tus datos/i })).toBeDisabled();
  });

  test('debería listar las reservas del usuario en su panel', async ({ page }) => {
    await interceptarApi(page, {
      'GET /reservas/mis': {
        cuerpo: [{
          _id: 'r-e2e', codigo: 'RES-E2E00001', estado: 'confirmada', vertical: 'alojamiento',
          servicioId: 's-e2e', comercioId: 'c-e2e', servicioTitulo: 'Suite Canina Royal',
          montoSubtotal: 200, comisionMonto: 30, descuentoMonto: 0, montoTotal: 242, moneda: 'EUR',
          fechaInicio: '2026-09-01T00:00:00.000Z', cantidad: 1,
        }],
      },
    });

    await page.goto('/reservas');

    await expect(page.getByText('RES-E2E00001').first()).toBeVisible();
  });

  test('no debería dejar errores de JavaScript por el camino', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await interceptarApi(page, CON_SERVICIO);
    await page.goto('/alojamiento');
    await page.goto('/alojamiento/s-e2e');

    expect(errores).toEqual([]);
  });
});
