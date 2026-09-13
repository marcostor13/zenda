import type { Page, Route } from '@playwright/test';
import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * Historial de servicios de las mascotas, en el navegador real.
 *
 * Cubre las dos mitades de la petición del cliente (2026-09-13): el comercio
 * entra en sus mascotas, anota lo que hizo en el servicio y descarga el PDF; el
 * dueño abre la ficha de su perro y ve ese registro con el detalle del
 * profesional. El contrato del API se prueba de verdad en
 * `apps/api/test/expedientes.e2e-spec.ts`; aquí, que las pantallas lo cumplen.
 */

const PERRO = {
  _id: 'p1', nombre: 'Nala', fotos: [], especie: 'perro', raza: 'Beagle', esMestizo: false, esterilizado: true,
  tipoPelo: ['corto'], vacunas: [], vacunasDetalle: [{ tipo: 'antirrabica', fecha: '2026-02-03' }],
  alergias: ['Pollo'], enfermedades: [], medicacion: ['Apoquel'], puedeQuedarseSolo: true, ansiedadSeparacion: true,
  miedos: ['Tormentas'], seMarea: false, requiereTransportin: false, autorizaCompartirHistorial: true,
  sexo: 'hembra', peso: 12, fechaNacimiento: '2021-04-02', microchip: '941000024681357', ciudad: 'Valencia',
};

const REGISTRO_PREVIO = {
  _id: 'r1', vertical: 'veterinaria', origen: 'comercio', titulo: 'Revisión anual', nota: 'Todo en orden.',
  datosEstructurados: { motivo: 'Chequeo', diagnostico: 'Otitis leve', pesoKg: 12 },
  fechaServicio: '2026-08-20', profesional: 'Dra. Pérez', comercioId: 'c1', comercioNombre: 'Clínica Royal', esPropio: true,
};

const RESERVA = {
  reservaId: 'res1', codigo: 'RES-NALA1', vertical: 'veterinaria', servicioTitulo: 'Consulta general',
  comercioId: 'c1', comercioNombre: 'Clínica Royal', fechaInicio: '2026-09-10T10:00:00.000Z', estado: 'completada',
};

/** Sirve un PDF de verdad (cabecera incluida) para el informe: el fixture sólo responde JSON. */
async function servirPdf(page: Page, patron: string): Promise<void> {
  await page.route(patron, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.3\n%%EOF') }),
  );
}

test.describe('Panel del comercio · mascotas e historial', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page, { nombre: 'Dra. Pérez', email: 'vet@royal.com', rol: 'comercio_admin' });
  });

  test('debería listar las mascotas, registrar un servicio y descargar el PDF', async ({ page }) => {
    let cuerpoRegistro: Record<string, unknown> | null = null;
    await interceptarApi(page, {
      'GET /comercios/mi-comercio': { cuerpo: { _id: 'c1', nombreComercial: 'Clínica Royal', verticales: ['veterinaria'], estado: 'activo', plan: 'pro' } },
      'GET /comercio/mascotas': {
        cuerpo: [{
          perroId: 'p1', nombre: 'Nala', raza: 'Beagle', alergias: ['Pollo'], enfermedades: [], tieneMedicacion: true,
          propietario: { nombre: 'Ana Ruiz', telefono: '+34 600 000 000' }, totalReservas: 1, serviciosCompletados: 1,
          verticales: ['veterinaria'], totalRegistros: 1, ultimoServicio: '2026-09-10',
        }],
      },
      'GET /comercio/mascotas/*': {
        cuerpo: { perro: PERRO, propietario: { nombre: 'Ana Ruiz', email: 'ana@ruiz.com', telefono: '+34 600 000 000' }, registros: [REGISTRO_PREVIO], servicios: [RESERVA] },
      },
      'POST /comercio/mascotas/*/registros': (route) => {
        cuerpoRegistro = route.request().postDataJSON();
        return {
          estado: 201,
          cuerpo: { ...REGISTRO_PREVIO, _id: 'r2', ...cuerpoRegistro, fechaServicio: '2026-09-12', comercioNombre: 'Clínica Royal', esPropio: true },
        };
      },
    });
    await servirPdf(page, '**/api/v1/comercio/mascotas/p1/informe');

    await page.goto('/comercio/mascotas');
    await expect(page.getByRole('heading', { name: 'Mascotas', exact: true })).toBeVisible();
    const tarjeta = page.getByRole('link', { name: /Nala/ });
    await expect(tarjeta).toContainText('Ana Ruiz');
    await expect(tarjeta).toContainText('Alergias');

    await tarjeta.click();
    await expect(page).toHaveURL(/\/comercio\/mascotas\/p1$/);
    await expect(page.getByRole('heading', { name: 'Nala', level: 1 })).toBeVisible();
    await expect(page.getByText('Alergia: Pollo')).toBeVisible();
    await expect(page.getByText('Revisión anual')).toBeVisible();

    await page.getByRole('button', { name: 'Nuevo registro' }).click();
    await page.getByRole('button', { name: 'Vacunación', exact: true }).click();
    await expect(page.getByLabel('Título *')).toHaveValue('Vacunación');
    await expect(page.getByLabel('Profesional')).toHaveValue('Dra. Pérez');
    await page.getByLabel('Reserva relacionada').selectOption('res1');
    await page.getByLabel('Diagnóstico').fill('Sano');
    await page.getByLabel('Vacunas aplicadas').fill('Antirrábica');
    await page.getByLabel('Peso (kg)').fill('12,4');
    await page.getByRole('button', { name: 'Guardar registro' }).click();

    await expect(page.getByText('Registro guardado en el historial.')).toBeVisible();
    expect(cuerpoRegistro).toMatchObject({
      vertical: 'veterinaria', reservaId: 'res1', titulo: 'Vacunación', profesional: 'Dra. Pérez',
      datosEstructurados: { diagnostico: 'Sano', vacunas: 'Antirrábica', pesoKg: '12,4' },
    });
    await expect(page.locator('app-registro-servicio').first()).toContainText('Vacunación');

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PDF' }).click();
    expect((await descarga).suggestedFilename()).toMatch(/^doogking-informe-nala-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  test('debería abrir el formulario ya vinculado al venir desde una reserva', async ({ page }) => {
    await interceptarApi(page, {
      'GET /comercios/mi-comercio': { cuerpo: { _id: 'c1', nombreComercial: 'Clínica Royal', verticales: ['veterinaria'], estado: 'activo' } },
      'GET /comercio/mascotas/*': { cuerpo: { perro: PERRO, registros: [], servicios: [RESERVA] } },
    });

    await page.goto('/comercio/mascotas/p1?registrar=veterinaria&reserva=res1');

    await expect(page.getByRole('heading', { name: 'Nuevo registro de servicio' })).toBeVisible();
    await expect(page.getByLabel('Reserva relacionada')).toHaveValue('res1');
  });

  test('debería explicar que la mascota no es suya si el API lo prohíbe', async ({ page }) => {
    await interceptarApi(page, {
      'GET /comercios/mi-comercio': { cuerpo: { _id: 'c1', nombreComercial: 'Clínica Royal', verticales: ['veterinaria'], estado: 'activo' } },
      'GET /comercio/mascotas/*': { estado: 403, cuerpo: { message: 'Este perro no tiene reservas con tu negocio' } },
    });

    await page.goto('/comercio/mascotas/p9');

    await expect(page.getByText('Esta mascota no tiene reservas con tu negocio.')).toBeVisible();
  });
});

test.describe('Cuenta del cliente · ficha completa del perro', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
    await interceptarApi(page, {
      'GET /perros/mis': { cuerpo: [PERRO] },
      'GET /perros/*/indice-comportamiento': { estado: 404, cuerpo: {} },
      'GET /perros/*/bienestar': {
        cuerpo: { perroId: 'p1', puntuacion: 82, nivel: 'muy_bueno', descuentoSeguroPct: 0.1, ejes: [{ clave: 'vacunas', etiqueta: 'Vacunas', puntos: 20, maximo: 25 }] },
      },
      'GET /perros/*/expediente': { cuerpo: { perro: PERRO, registros: [REGISTRO_PREVIO], servicios: [RESERVA] } },
    });
    await servirPdf(page, '**/api/v1/perros/p1/informe');
  });

  test('debería llegar desde "Mis perros" y ver lo que anotó el veterinario', async ({ page }) => {
    await page.goto('/perros');
    await page.getByRole('link', { name: 'Ver ficha completa' }).click();

    await expect(page).toHaveURL(/\/perros\/p1$/);
    await expect(page.getByRole('heading', { name: 'Nala', level: 1 })).toBeVisible();
    await expect(page.getByText('Alergias:')).toBeVisible();
    await expect(page.getByText('Actividad reciente')).toBeVisible();
    const reciente = page.locator('app-registro-servicio').first();
    await expect(reciente).toContainText('Revisión anual');
    await expect(reciente).toContainText('Clínica Royal');
    await expect(reciente).toContainText('Otitis leve');
    await expect(page.getByText('Índice de Bienestar')).toBeVisible();
  });

  test('debería recorrer las pestañas de la ficha y conservarlas en la URL', async ({ page }) => {
    await page.goto('/perros/p1');

    await page.getByRole('tab', { name: /Historial/ }).click();
    await expect(page).toHaveURL(/tab=historial/);
    await expect(page.getByText('Servicios reservados en Doogking')).toBeVisible();
    await expect(page.getByText('RES-NALA1', { exact: false })).toBeVisible();

    await page.getByRole('tab', { name: 'Salud' }).click();
    await expect(page.locator('app-ficha-perro-datos')).toContainText('Antirrábica');
    await expect(page.locator('app-ficha-perro-datos')).toContainText('Apoquel');

    await page.getByRole('tab', { name: 'Comportamiento' }).click();
    await expect(page.locator('app-ficha-perro-datos')).toContainText('Ansiedad por separación');

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Comportamiento' })).toHaveAttribute('aria-selected', 'true');
  });

  test('debería descargar la ficha en PDF', async ({ page }) => {
    await page.goto('/perros/p1');

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PDF' }).click();

    expect((await descarga).suggestedFilename()).toMatch(/^doogking-informe-nala-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  test('no debería desbordar horizontalmente la pantalla', async ({ page }) => {
    await page.goto('/perros/p1');
    await expect(page.getByRole('heading', { name: 'Nala', level: 1 })).toBeVisible();

    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(desborda).toBe(false);
  });
});
