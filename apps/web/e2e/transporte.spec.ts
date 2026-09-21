import { test, expect, interceptarApi, sesionIniciada, type Rutas } from './fixtures/api';

/**
 * E2E de "Transporte de mascotas": el alta del comercio y el flujo del cliente,
 * los dos recorridos que describen los documentos de especificación.
 *
 * Lo que se comprueba aquí y no se puede comprobar en un test unitario es que
 * las dos mitades encajan: que la empresa declara sus tarifas con el asistente
 * y que el cliente, del otro lado, ve exactamente el importe que sale de esas
 * mismas reglas. El API va interceptado (`fixtures/api.ts`), así que el precio
 * que se lee en pantalla lo ha calculado el motor compartido, no un doble.
 */

/** Una empresa que cobra 25 € dentro de Castellón y por km fuera. */
const REGLAS_TARIFA = [
  {
    id: 'r-zona', nombre: 'Castellón ciudad', modelo: 'zona', unidadCobro: 'vehiculo',
    zonas: ['Castellón'], precioIda: 25, precioIdaVuelta: 45,
  },
  {
    id: 'r-km', nombre: 'Provincia', modelo: 'km', unidadCobro: 'vehiculo',
    precioKm: 0.8, importeMinimo: 25,
  },
];

const SERVICIO = {
  id: 't-e2e',
  nombre: 'VilaCan Traslados',
  ciudad: 'Castellón',
  barrio: 'Centro',
  direccion: 'Avinguda del Mar 1',
  comercioId: 'c-e2e',
  precioPorNoche: 25,
  score: 4.7,
  scoreLabel: 'Muy bueno',
  numResenas: 31,
  imagenes: ['https://example.test/van.jpg'],
  destacado: false,
  amenities: [],
  cancelacionGratis: true,
};

/** Ficha del transportista, con la configuración del alta guiada. */
const ficha = (extra: Record<string, unknown>) => ({
  ...SERVICIO,
  descripcion: 'Traslados puerta a puerta con furgoneta climatizada.',
  resenas: [],
  espacios: [],
  habitaciones: [],
  extra: {
    tipoVehiculo: 'furgon_climatizado',
    capacidadPerros: 4,
    redondeoDistancia: 'exacta',
    baseKilometraje: 'recogida_destino',
    esperaIncluidaMin: 30,
    politicaParadas: 'con_suplemento',
    maxMascotasPorReserva: 3,
    plazasAcompanantes: 2,
    ...extra,
  },
});

const rutasCliente = (extra: Record<string, unknown>): Rutas => ({
  'GET /catalog/servicios': { cuerpo: { items: [SERVICIO], total: 1, page: 1, totalPages: 1 } },
  'GET /catalog/servicios/facetas': { cuerpo: { histogramaPrecio: [], amenities: [], valoraciones: [] } },
  'GET /catalog/servicios/*': { cuerpo: ficha(extra) },
});

/** Dirección del wizard con el servicio ya elegido. */
const RESERVA_URL =
  '/reservas/transporte/t-e2e?comercioId=c-e2e&nombre=VilaCan%20Traslados&precioBase=25';

// ── Cliente ───────────────────────────────────────────────────────────────

test.describe('Cliente · reservar un transporte', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
  });

  test('debería preguntar por la necesidad antes que por nada más', async ({ page }) => {
    await interceptarApi(page, rutasCliente({ reglasTarifa: REGLAS_TARIFA }));

    await page.goto(RESERVA_URL);

    await expect(page.getByText('¿Qué tipo de servicio necesitas?')).toBeVisible();
    await expect(page.getByTestId('necesidad-solo_ida')).toBeVisible();
    await expect(page.getByTestId('necesidad-ida_vuelta')).toBeVisible();
    await expect(page.getByTestId('necesidad-viajo_con_mi_mascota')).toBeVisible();
  });

  /**
   * La regla que ordena el vertical: el cliente describe lo que necesita y
   * Doogking lo traduce. En su pantalla no aparece «€/km» ni «precio por zona».
   */
  test('no debería enseñar el sistema tarifario de la empresa', async ({ page }) => {
    await interceptarApi(page, rutasCliente({ reglasTarifa: REGLAS_TARIFA }));

    await page.goto(RESERVA_URL);
    await expect(page.getByText('¿Qué tipo de servicio necesitas?')).toBeVisible();

    const texto = (await page.locator('form.tr').innerText()).toLowerCase();
    expect(texto).not.toContain('€/km');
    expect(texto).not.toContain('precio por zona');
    expect(texto).not.toContain('tarifa base');
  });

  test('debería cobrar la tarifa de zona dentro de la ciudad', async ({ page }) => {
    await interceptarApi(page, rutasCliente({ reglasTarifa: REGLAS_TARIFA }));

    await page.goto(RESERVA_URL);
    await page.locator('#wz-origen').fill('Castellón');
    await page.locator('#wz-destino').fill('Castellón');
    await page.locator('#wz-distancia').fill('8');

    await expect(page.getByTestId('total-transporte')).toContainText('25');
  });

  /**
   * Fuera de la zona manda la siguiente regla. Es el caso que antes daba un
   * precio equivocado: el cliente de la ciudad veía la tarifa por kilómetro.
   */
  test('debería pasar al precio por kilómetro fuera de la zona', async ({ page }) => {
    await interceptarApi(page, rutasCliente({ reglasTarifa: REGLAS_TARIFA }));

    await page.goto(RESERVA_URL);
    await page.locator('#wz-origen').fill('Valencia');
    await page.locator('#wz-destino').fill('Alicante');
    await page.locator('#wz-distancia').fill('100');

    await expect(page.getByTestId('total-transporte')).toContainText('80');
  });

  test('debería sumar al total el suplemento que el cliente pide', async ({ page }) => {
    await interceptarApi(page, rutasCliente({
      reglasTarifa: [REGLAS_TARIFA[0]],
      suplementos: [{
        clave: 'transportin_empresa', nombre: 'Transportín de la empresa',
        condicion: 'siempre', forma: 'importe_fijo', importe: 8, aplicacion: 'a_peticion',
      }],
    }));

    await page.goto(RESERVA_URL);
    await page.locator('#wz-origen').fill('Castellón');
    await page.locator('#wz-distancia').fill('8');
    await expect(page.getByTestId('total-transporte')).toContainText('25');

    await page.getByTestId('extra-transportin_empresa').check();

    await expect(page.getByTestId('total-transporte')).toContainText('33');
  });

  test('debería pedir la hora solo a quien no es flexible', async ({ page }) => {
    await interceptarApi(page, rutasCliente({ reglasTarifa: REGLAS_TARIFA }));

    await page.goto(RESERVA_URL);
    await expect(page.locator('#wz-hora')).toBeVisible();

    await page.locator('#wz-flex').selectOption('flexible');

    await expect(page.locator('#wz-hora')).toHaveCount(0);
    await expect(page.locator('#wz-franja')).toBeVisible();
  });

  test('debería pedir los datos de quien recibe cuando no es el propio cliente', async ({ page }) => {
    await interceptarApi(page, rutasCliente({ reglasTarifa: REGLAS_TARIFA }));

    await page.goto(RESERVA_URL);
    await expect(page.locator('#wz-recibe-nombre')).toHaveCount(0);

    await page.locator('#wz-quien-recibe').selectOption('otra_persona');

    await expect(page.locator('#wz-recibe-nombre')).toBeVisible();
    await expect(page.locator('#wz-recibe-tel')).toBeVisible();
  });

  /**
   * Sin precio cerrado no se dice «no disponible»: se ofrece presupuesto, que
   * es la diferencia entre perder la venta y empezarla.
   */
  test('debería ofrecer presupuesto cuando la empresa calcula a medida', async ({ page }) => {
    await interceptarApi(page, rutasCliente({
      reglasTarifa: [{
        id: 'r-pre', nombre: 'A medida', modelo: 'presupuesto', unidadCobro: 'vehiculo',
      }],
    }));

    await page.goto(RESERVA_URL);
    await page.locator('#wz-distancia').fill('900');

    await expect(page.getByTestId('desglose-transporte')).toContainText('presupuesto');
    await expect(page.getByTestId('total-transporte')).toHaveCount(0);
  });

  test('debería enviar el viaje completo al crear la reserva', async ({ page }) => {
    let enviado: Record<string, unknown> | null = null;

    await interceptarApi(page, {
      ...rutasCliente({ reglasTarifa: REGLAS_TARIFA }),
      'POST /reservas': (route) => {
        enviado = route.request().postDataJSON() as Record<string, unknown>;
        return {
          estado: 201,
          cuerpo: {
            _id: 'r-e2e', codigo: 'RES-E2ETR001', estado: 'pendiente',
            montoSubtotal: 20.66, comisionMonto: 3.7, montoTotal: 25, moneda: 'EUR',
            vertical: 'transporte', servicioId: 't-e2e', comercioId: 'c-e2e',
            fechaInicio: '2027-03-01', cantidad: 1,
          },
        };
      },
      'POST /payments/intent': {
        estado: 201,
        cuerpo: { clientSecret: 'pi_e2e_secret', pagoId: 'p-e2e', montoTotal: 25, moneda: 'EUR' },
      },
    });

    await page.goto(RESERVA_URL);
    await page.locator('#wz-fecha').fill('2027-03-01');
    await page.locator('#wz-hora').fill('10:00');
    await page.locator('#wz-origen').fill('Castellón');
    await page.locator('#wz-destino').fill('Castellón');
    await page.locator('#wz-distancia').fill('8');
    await page.locator('#wz-quien-recibe').selectOption('otra_persona');
    await page.locator('#wz-recibe-nombre').fill('Clínica Vila-real');
    await page.locator('#wz-recibe-tel').fill('600111222');

    await page.getByRole('button', { name: /Continuar . Tus datos/i }).click();
    await page.getByPlaceholder('Tu nombre').fill('Ana');
    await page.getByPlaceholder('Tus apellidos').fill('Ruiz');
    await page.getByPlaceholder('tu@email.com').fill('ana@ruiz.test');
    await page.getByPlaceholder('600 000 000').fill('600123456');
    await page.getByRole('checkbox', { name: /información de mi mascota/i }).check();
    await page.getByRole('checkbox', { name: /Acepto los/i }).check();
    await page.getByRole('button', { name: /Continuar . Pago/i }).click();

    // Lo que importa es que el viaje viaja entero: sin los contactos, el
    // conductor llega a una puerta sin saber a quién preguntar.
    await expect.poll(() => enviado, { timeout: 15_000 }).not.toBeNull();
    const detalle = (enviado as unknown as { detalle: Record<string, unknown> }).detalle;
    expect(detalle['origen']).toBe('Castellón');
    expect(detalle['distanciaKm']).toBe(8);
    expect(detalle['entrega']).toMatchObject({
      responsable: 'otra_persona', nombre: 'Clínica Vila-real', telefono: '600111222',
    });
  });
});

// ── Comercio ──────────────────────────────────────────────────────────────

test.describe('Comercio · alta del servicio de transporte', () => {
  const RUTAS_COMERCIO: Rutas = {
    'GET /comercios/mi-comercio': {
      cuerpo: {
        _id: 'c-e2e', nombreComercial: 'VilaCan', verticales: ['transporte'],
        estado: 'activo', plan: 'pro',
      },
    },
    'POST /catalog/servicios': { estado: 201, cuerpo: { _id: 't-nuevo' } },
  };

  /**
   * Pasa al siguiente paso del formulario del listado.
   *
   * Es el botón del pie ("Continuar"), no el del asistente de transporte
   * ("Siguiente"), que navega solo entre los seis pasos de dentro.
   */
  async function continuar(page: import('@playwright/test').Page): Promise<void> {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  }

  /** Deja el formulario en el paso de detalles, ya con la categoría elegida. */
  async function irADetallesDeTransporte(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/comercio/listados/nuevo');

    await page.locator('#vertical').selectOption('transporte');
    await page.locator('#titulo').fill('Traslados puerta a puerta');
    await page.locator('#descripcion').fill(
      'Furgoneta climatizada con habitáculos individuales para llevar a tu mascota al veterinario, a la peluquería o al aeropuerto.',
    );
    await continuar(page);

    await page.locator('#ciudad').fill('Castellón');
    await page.locator('#precioBase').fill('25');
    await continuar(page);

    // Horarios: un transporte a demanda no tiene puerta que abrir.
    await continuar(page);

    await expect(page.getByTestId('paso-tipo')).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page, { rol: 'comercio_admin' });
    await interceptarApi(page, RUTAS_COMERCIO);
    // El alta guarda borrador en el dispositivo: sin limpiarlo, una prueba
    // arrancaría con lo que escribió la anterior.
    await page.addInitScript(() => localStorage.removeItem('dk_borrador_listado'));
  });

  test('debería abrir el asistente de seis pasos', async ({ page }) => {
    await irADetallesDeTransporte(page);

    await expect(page.getByTestId('plantilla-exclusivo')).toBeVisible();
    await expect(page.getByTestId('plantilla-taxi_petfriendly')).toBeVisible();
    await expect(page.getByTestId('plantilla-ruta_programada')).toBeVisible();
  });

  test('debería avisar de que sin tarifa no se puede publicar', async ({ page }) => {
    await irADetallesDeTransporte(page);

    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();

    await expect(page.getByTestId('sin-reglas')).toBeVisible();
  });

  /**
   * La simulación usa el mismo motor que cobrará el API. Es lo que permite a
   * la empresa ver lo que pagará su cliente **antes** de publicar.
   */
  test('debería simular el precio con la tarifa que acaba de configurar', async ({ page }) => {
    await irADetallesDeTransporte(page);

    // Paso 3: una tarifa por kilómetro.
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('anadir-regla').click();

    const regla = page.getByTestId('regla-0');
    await regla.locator('select').first().selectOption('km');
    await regla.locator('input[formControlName="precioKm"]').fill('0.8');

    // Paso 6: la simulación, con el trayecto de ejemplo del documento.
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();

    await page.locator('#sim-km').fill('74');
    await expect(page.getByTestId('simulacion-total')).toContainText('118');
  });

  test('debería marcar la tarifa como cumplida en las comprobaciones', async ({ page }) => {
    await irADetallesDeTransporte(page);

    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('anadir-regla').click();
    const regla = page.getByTestId('regla-0');
    await regla.locator('select').first().selectOption('fijo');
    await regla.locator('input[formControlName="precioIda"]').fill('25');

    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();

    const checklist = page.getByTestId('checklist');
    await expect(checklist.locator('li.is-ok')).toHaveCount(5);
  });

  /**
   * Las reglas viven en un `FormArray` dentro del grupo del vertical, y el
   * formulario del listado monta y desmonta cada paso. Lo que se comprueba aquí
   * es que ir y volver no se las lleva por delante: perderlas significaría
   * publicar un servicio sin precio.
   *
   * Que el payload salga bien formado se comprueba en el test unitario del
   * formulario, que puede dar por puestas las cinco fotos obligatorias.
   */
  test('debería conservar las tarifas al salir y volver al paso de detalles', async ({ page }) => {
    await irADetallesDeTransporte(page);

    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('anadir-regla').click();
    const regla = page.getByTestId('regla-0');
    await regla.locator('input[formControlName="nombre"]').fill('Castellón ciudad');
    await regla.locator('select').first().selectOption('fijo');
    await regla.locator('input[formControlName="precioIda"]').fill('25');

    // Salir al paso anterior del formulario y volver a entrar.
    await page.getByRole('button', { name: 'Atrás', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await expect(page.getByTestId('paso-tipo')).toBeVisible();
    await page.getByTestId('siguiente-paso').click();
    await page.getByTestId('siguiente-paso').click();

    await expect(page.getByTestId('regla-0').locator('input[formControlName="nombre"]'))
      .toHaveValue('Castellón ciudad');
    await expect(page.getByTestId('regla-0').locator('input[formControlName="precioIda"]'))
      .toHaveValue('25');
  });
});
