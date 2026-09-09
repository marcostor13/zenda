import { test, expect, interceptarApi, sesionIniciada, type Rutas } from './fixtures/api';

/**
 * E2E del alta de comercio en la interfaz: el recorrido completo que hace un
 * profesional para entrar en Doogking, en un navegador de verdad.
 *
 * Complementa a `apps/api/test/comercio-alta.e2e-spec.ts`, que ejercita el mismo
 * flujo contra el API real: allí se comprueba qué se guarda y qué se rechaza;
 * aquí, que la pantalla lleva de un paso al siguiente, que envía lo que dice
 * enviar y que cuando algo falla el comercio entiende qué hacer.
 *
 * Es un recorrido con historial: en él se han roto ya el submit del formulario
 * (una directiva que no casaba con el `<form>`) y el borrador guardado en el
 * dispositivo (categorías de un catálogo antiguo). Las dos siguen cubiertas.
 */

const ALTA = {
  nombre: 'Ana Torres',
  email: 'ana@royaldog.eu',
  password: 'Segura123!',
};

const BORRADOR = 'dk_registro_comercio_borrador';

/** Respuesta normal del API: el alta queda pendiente de verificar el correo. */
const REGISTRO_OK: Rutas = {
  'POST /comercios/registro': {
    estado: 201,
    cuerpo: { requiereVerificacion: true, email: ALTA.email },
  },
};

test.describe('Alta de comercio', () => {
  /** Deja la pantalla en el paso 2, con las categorías indicadas ya marcadas. */
  async function irAlPasoDeCuenta(
    page: import('@playwright/test').Page,
    categorias: readonly string[] = ['Peluquerías caninas'],
  ): Promise<void> {
    await page.goto('/auth/registro-comercio');
    for (const categoria of categorias) {
      await page.locator('.rc-cat', { hasText: categoria }).click();
    }
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('form.rc-form')).toBeVisible();
  }

  /** Rellena los datos de acceso del paso 2. */
  async function rellenarCuenta(page: import('@playwright/test').Page): Promise<void> {
    await page.locator('#nombre').fill(ALTA.nombre);
    await page.locator('#email').fill(ALTA.email);
    await page.locator('#password').fill(ALTA.password);
  }

  // ── Paso 1: elegir categorías ───────────────────────────────────────────

  test.describe('paso 1 · qué servicios ofrece', () => {
    test.beforeEach(async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      await page.goto('/auth/registro-comercio');
    });

    test('debería ofrecer las ocho categorías del catálogo', async ({ page }) => {
      await expect(page.locator('.rc-cats .rc-cat')).toHaveCount(8);
    });

    /** Sin categoría no se puede seguir: es el dato que define el negocio. */
    test('no debería dejar continuar sin marcar ninguna', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
      await expect(page.getByText(/Elige al menos un servicio/i)).toBeVisible();
    });

    test('debería habilitar el paso siguiente al marcar una', async ({ page }) => {
      await page.locator('.rc-cat', { hasText: 'Peluquerías caninas' }).click();

      await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
      await expect(page.getByText('1 servicio seleccionado')).toBeVisible();
    });

    test('debería permitir marcar varias y desmarcarlas', async ({ page }) => {
      const peluqueria = page.locator('.rc-cat', { hasText: 'Peluquerías caninas' });
      const veterinaria = page.locator('.rc-cat', { hasText: 'Veterinarios' });

      await peluqueria.click();
      await veterinaria.click();
      await expect(page.getByText('2 servicios seleccionados')).toBeVisible();

      await veterinaria.click();
      await expect(page.getByText('1 servicio seleccionado')).toBeVisible();
      await expect(peluqueria).toHaveAttribute('aria-pressed', 'true');
      await expect(veterinaria).toHaveAttribute('aria-pressed', 'false');
    });

    test('debería guardar lo marcado en el dispositivo', async ({ page }) => {
      await page.locator('.rc-cat', { hasText: 'Peluquerías caninas' }).click();

      const guardado = await page.evaluate(
        (clave) => JSON.parse(localStorage.getItem(clave) ?? '{}'),
        BORRADOR,
      );
      expect(guardado.verticales).toEqual(['peluqueria']);
    });

    /** La contraseña nunca se guarda en el dispositivo, aunque el borrador sí. */
    test('no debería guardar nada de los datos de acceso', async ({ page }) => {
      await irAlPasoDeCuenta(page);
      await rellenarCuenta(page);

      const todo = await page.evaluate(() => JSON.stringify(localStorage));
      expect(todo).not.toContain(ALTA.password);
      expect(todo).not.toContain(ALTA.email);
    });
  });

  // ── El borrador guardado ────────────────────────────────────────────────

  test.describe('borrador guardado en el dispositivo', () => {
    test('debería recuperar las categorías de la vez anterior', async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      await page.addInitScript(
        ([clave, valor]) => localStorage.setItem(clave, valor),
        [BORRADOR, JSON.stringify({ verticales: ['peluqueria', 'veterinaria'] })] as const,
      );

      await page.goto('/auth/registro-comercio');

      await expect(page.getByText('2 servicios seleccionados')).toBeVisible();
      await expect(page.getByText(/Guardamos tu progreso/i)).toBeVisible();
    });

    /**
     * Regresión (observación del cliente del 09-09-2026): un borrador de antes
     * del 1-09 traía «cuidadores», retirada del catálogo, y el alta moría con
     * «each value in verticales must be one of…», un mensaje que el comercio no
     * podía relacionar con nada de lo que veía en pantalla.
     */
    test('debería descartar las categorías que ya no existen', async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      await page.addInitScript(
        ([clave, valor]) => localStorage.setItem(clave, valor),
        [BORRADOR, JSON.stringify({ verticales: ['cuidadores', 'peluqueria'] })] as const,
      );

      await page.goto('/auth/registro-comercio');

      await expect(page.getByText('1 servicio seleccionado')).toBeVisible();
      const guardado = await page.evaluate(
        (clave) => JSON.parse(localStorage.getItem(clave) ?? '{}'),
        BORRADOR,
      );
      expect(guardado.verticales).toEqual(['peluqueria']);
    });

    test('debería empezar de cero si ninguna sigue vigente', async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      await page.addInitScript(
        ([clave, valor]) => localStorage.setItem(clave, valor),
        [BORRADOR, JSON.stringify({ verticales: ['cuidadores'] })] as const,
      );

      await page.goto('/auth/registro-comercio');

      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
      const guardado = await page.evaluate((clave) => localStorage.getItem(clave), BORRADOR);
      expect(guardado).toBeNull();
    });

    test('debería sobrevivir a un borrador ilegible', async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      await page.addInitScript(
        (clave) => localStorage.setItem(clave, 'no-es-json'),
        BORRADOR,
      );

      await page.goto('/auth/registro-comercio');

      await expect(page.locator('.rc-cats .rc-cat')).toHaveCount(8);
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    });
  });

  // ── Paso 2: la cuenta ───────────────────────────────────────────────────

  test.describe('paso 2 · datos de acceso', () => {
    test.beforeEach(async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
    });

    test('debería poder volver al paso anterior sin perder lo marcado', async ({ page }) => {
      await irAlPasoDeCuenta(page, ['Peluquerías caninas', 'Veterinarios']);

      await page.getByRole('button', { name: 'Atrás' }).click();

      await expect(page.getByText('2 servicios seleccionados')).toBeVisible();
    });

    test('debería avisar de los campos mal rellenados sin llamar al API', async ({ page }) => {
      let llamadas = 0;
      page.on('request', (r) => {
        if (r.url().includes('/comercios/registro')) llamadas++;
      });

      await irAlPasoDeCuenta(page);
      await page.locator('#nombre').fill('A');
      await page.locator('#email').fill('no-es-un-email');
      await page.locator('#password').fill('corta');
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      await expect(page.getByText('Escribe un correo válido')).toBeVisible();
      await expect(page.getByText(/al menos 8 caracteres/i)).toBeVisible();
      expect(llamadas).toBe(0);
    });

    test('debería dejar ver la contraseña escrita', async ({ page }) => {
      await irAlPasoDeCuenta(page);
      await page.locator('#password').fill(ALTA.password);

      await expect(page.locator('#password')).toHaveAttribute('type', 'password');
      await page.locator('.rc-pw__toggle').click();
      await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    });

    test('debería enlazar los términos y la política de privacidad', async ({ page }) => {
      await irAlPasoDeCuenta(page);

      const legal = page.locator('.rc-legal');
      await expect(legal.getByRole('link', { name: 'Términos' })).toHaveAttribute('href', '/terminos');
      await expect(legal.getByRole('link', { name: /privacidad/i })).toHaveAttribute('href', '/privacidad');
    });
  });

  // ── El envío ────────────────────────────────────────────────────────────

  test.describe('crear el negocio', () => {
    test('debería enviar el alta con las categorías marcadas y confirmar', async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      const envio = page.waitForRequest((r) => r.url().includes('/comercios/registro'));

      await irAlPasoDeCuenta(page, ['Peluquerías caninas', 'Veterinarios']);
      await rellenarCuenta(page);
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      const peticion = await envio;
      expect(peticion.postDataJSON()).toMatchObject({
        nombre: ALTA.nombre,
        email: ALTA.email,
        password: ALTA.password,
        verticales: ['peluqueria', 'veterinaria'],
      });

      await expect(page.getByRole('heading', { name: /Tu cuenta ya está creada/i })).toBeVisible();
      await expect(page.getByText(ALTA.email)).toBeVisible();
    });

    /**
     * Regresión: el `<form>` del alta llevaba los `formGroup` en los `<div>` de
     * dentro y ninguna directiva casaba con él, así que `(ngSubmit)` no lo
     * emitía nadie: el botón hacía un submit del navegador, la SPA arrancaba de
     * cero y el alta parecía «volver al paso 1».
     */
    test('no debería recargar la página al enviar', async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      await irAlPasoDeCuenta(page);
      await rellenarCuenta(page);

      // Si el navegador hiciera un submit nativo, este marcador se perdería.
      await page.evaluate(() => { (window as unknown as Record<string, unknown>)['sigueViva'] = true; });
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      await expect(page.getByRole('heading', { name: /Tu cuenta ya está creada/i })).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as Record<string, unknown>)['sigueViva'])).toBe(true);
      await expect(page).toHaveURL(/\/auth\/registro-comercio$/);
    });

    test('debería limpiar el borrador una vez creado el negocio', async ({ page }) => {
      await interceptarApi(page, REGISTRO_OK);
      await irAlPasoDeCuenta(page);
      await rellenarCuenta(page);
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      await expect(page.getByRole('heading', { name: /Tu cuenta ya está creada/i })).toBeVisible();
      expect(await page.evaluate((clave) => localStorage.getItem(clave), BORRADOR)).toBeNull();
    });

    test('debería poder reenviar el correo de verificación', async ({ page }) => {
      await interceptarApi(page, {
        ...REGISTRO_OK,
        'POST /auth/reenviar-verificacion': { cuerpo: {} },
      });
      await irAlPasoDeCuenta(page);
      await rellenarCuenta(page);
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      await page.getByRole('button', { name: /Reenviar correo/i }).click();

      await expect(page.getByText(/Correo reenviado/i)).toBeVisible();
    });
  });

  // ── Cuando el API rechaza el alta ───────────────────────────────────────

  test.describe('errores del alta', () => {
    test('debería ofrecer entrar si el correo ya está registrado', async ({ page }) => {
      await interceptarApi(page, {
        'POST /comercios/registro': { estado: 409, cuerpo: { message: 'El email ya está registrado' } },
      });

      await irAlPasoDeCuenta(page);
      await rellenarCuenta(page);
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      await expect(page.getByText(/ya está registrado/i)).toBeVisible();
      await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/auth/login');
    });

    /**
     * Un 400 aquí es casi siempre la selección de categorías. Repetir el envío
     * con lo mismo daría el mismo error, así que se devuelve al paso 1 con el
     * borrador limpio en vez de dejar al comercio reintentando a ciegas.
     */
    test('debería devolver al paso 1 si el API rechaza las categorías', async ({ page }) => {
      await interceptarApi(page, {
        'POST /comercios/registro': {
          estado: 400,
          cuerpo: { message: ['each value in verticales must be one of the following values'] },
        },
      });

      await irAlPasoDeCuenta(page);
      await rellenarCuenta(page);
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      await expect(page.getByText(/categorías elegidas ya no está disponible/i)).toBeVisible();
      await expect(page.locator('.rc-cats .rc-cat')).toHaveCount(8);
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
      expect(await page.evaluate((clave) => localStorage.getItem(clave), BORRADOR)).toBeNull();
    });

    test('debería avisar sin culpar al comercio si el servidor falla', async ({ page }) => {
      await interceptarApi(page, {
        'POST /comercios/registro': { estado: 500, cuerpo: { message: 'Boom' } },
      });

      await irAlPasoDeCuenta(page);
      await rellenarCuenta(page);
      await page.getByRole('button', { name: /Crear mi negocio/ }).click();

      await expect(page.getByText(/No pudimos crear tu negocio/i)).toBeVisible();
      // Y los datos siguen escritos: no hay que teclearlo todo otra vez.
      await expect(page.locator('#email')).toHaveValue(ALTA.email);
    });
  });

  // ── Cómo se llega al alta ───────────────────────────────────────────────

  test.describe('acceso al alta desde la plataforma', () => {
    test('debería llegarse desde la landing de empresas', async ({ page }) => {
      await interceptarApi(page);
      await page.goto('/para-comercios');

      await page.getByRole('link', { name: /Registrar mi negocio gratis/i }).first().click();

      await expect(page).toHaveURL(/\/auth\/registro-comercio$/);
      await expect(page.getByRole('heading', { name: /¿Qué servicios ofreces\?/ })).toBeVisible();
    });

    test('debería ofrecerse desde el acceso de clientes', async ({ page }) => {
      await interceptarApi(page);
      await page.goto('/auth/login');

      await expect(
        page.getByRole('link', { name: /Regístralo en Doogking/i }),
      ).toHaveAttribute('href', '/auth/registro-comercio');
    });

    /** A quien ya tiene sesión no se le ofrece: el alta crea una cuenta nueva. */
    test('no debería ofrecerse a un cliente ya identificado', async ({ page }) => {
      await interceptarApi(page);
      await sesionIniciada(page);
      await page.goto('/');

      await expect(page.locator('.rs-navbar__link--pro')).toHaveCount(0);
    });
  });
});
