import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * Observaciones del cliente del 9 de septiembre de 2026.
 *
 * Una prueba por observación, en el navegador real, porque todas se
 * manifestaban en pantalla y ninguna se veía desde una prueba unitaria: un
 * enlace que resuelve mal contra la etiqueta base del índice, una ruta que el
 * comodín se traga, un atributo interno que llega a una ficha. El plan y la
 * causa de cada una están en `docs/PLAN-OBSERVACIONES-09-09.md`.
 */

test.describe('O3 · Términos, cookies y contacto tienen página propia', () => {
  test.beforeEach(async ({ page }) => {
    await interceptarApi(page);
  });

  /*
   * Regresión: las tres rutas no existían y el comodín `**` devolvía a la
   * portada, así que los enlaces del pie parecían llevar al inicio.
   */
  const DOCUMENTOS = [
    { ruta: '/terminos', titular: /términos y condiciones/i },
    { ruta: '/cookies', titular: /política de cookies/i },
    { ruta: '/contacto', titular: /^contacto$/i },
  ];

  for (const { ruta, titular } of DOCUMENTOS) {
    test(`${ruta} debería abrir su documento y no la portada`, async ({ page }) => {
      await page.goto(ruta);

      await expect(page).toHaveURL(new RegExp(`${ruta}$`));
      await expect(page.locator('h1')).toContainText(titular);
      await expect(page.locator('.hero__title')).toHaveCount(0);
    });
  }

  test('el pie de la portada debería llevar a los tres documentos', async ({ page }) => {
    await page.goto('/');

    for (const [enlace, destino] of [
      ['Términos', '/terminos'],
      ['Cookies', '/cookies'],
      ['Contacto', '/contacto'],
    ] as const) {
      await expect(
        page.getByRole('link', { name: enlace, exact: true }).first(),
      ).toHaveAttribute('href', destino);
    }
  });

  test('la política de cookies debería enumerar lo que se guarda de verdad', async ({ page }) => {
    await page.goto('/cookies');

    // Las claves de la tabla existen en el código (auth.service, i18n.service…).
    await expect(page.getByText('zenda_token')).toBeVisible();
    await expect(page.getByText('doogking_idioma')).toBeVisible();
  });
});

test.describe('O6 · Las anclas de /para-comercios bajan a su sección', () => {
  const SECCIONES = [
    { texto: 'Ventajas', id: 'ventajas' },
    { texto: 'Cómo empezar', id: 'como-empezar' },
    { texto: 'Planes', id: 'planes' },
    { texto: 'Preguntas', id: 'preguntas' },
  ];

  /*
   * Sólo en escritorio: en móvil la barra oculta su navegación
   * (`.pc-bar__nav { display: none }`) y deja sólo marca y accesos, así que no
   * hay ancla que pulsar.
   */
  test.skip(({ isMobile }) => !!isMobile, 'La barra de secciones no se pinta en móvil');

  test.beforeEach(async ({ page }) => {
    await interceptarApi(page);
    await page.goto('/para-comercios');
  });

  /*
   * Regresión: el índice declara una etiqueta base apuntando a la raíz, así que
   * un href con almohadilla resolvía contra ella y llevaba a la portada.
   */
  for (const { texto, id } of SECCIONES) {
    test(`«${texto}» debería quedarse en la página y saltar a su sección`, async ({ page }) => {
      await page.locator('.pc-bar__nav').getByRole('link', { name: texto }).click();

      await expect(page).toHaveURL(new RegExp(`/para-comercios#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 0.05 });
    });
  }

  test('ninguna ancla de la barra debería apuntar a la raíz', async ({ page }) => {
    const hrefs = await page.locator('.pc-bar__nav a').evaluateAll(
      (enlaces) => enlaces.map((a) => a.getAttribute('href')),
    );

    expect(hrefs.length).toBe(SECCIONES.length);
    for (const href of hrefs) expect(href).toContain('/para-comercios');
  });
});

test.describe('O1 · Alta de negocio y sesión caducada', () => {
  /** El alta es captación: a quien ya tiene sesión no se le ofrece. */
  test('no debería ofrecer «Registra tu empresa» a un cliente identificado', async ({ page }) => {
    await interceptarApi(page);
    await sesionIniciada(page);
    await page.goto('/');

    await expect(page.locator('.rs-navbar__link--pro')).toHaveCount(0);
  });

  test('debería ofrecerlo al visitante', async ({ page }) => {
    await interceptarApi(page);
    await page.goto('/');

    // Se mira que esté, no que se vea: en móvil este enlace vive en el menú
    // desplegable y la barra sólo lo pinta a partir de cierto ancho.
    await expect(page.locator('.rs-navbar__link--pro')).toHaveCount(1);
  });

  /*
   * Regresión: un borrador guardado antes de que el catálogo cambiara traía
   * categorías retiradas, el API respondía «each value in verticales must be
   * one of…» y el comercio no podía relacionarlo con nada de la pantalla.
   */
  test('debería descartar del borrador las categorías que ya no existen', async ({ page }) => {
    await interceptarApi(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'dk_registro_comercio_borrador',
        JSON.stringify({ verticales: ['cuidadores', 'peluqueria'] }),
      );
    });

    await page.goto('/auth/registro-comercio');
    // El paso 1 es la rejilla de categorías; el formulario llega en el paso 2.
    await expect(page.locator('.rc-cats .rc-cat').first()).toBeVisible();

    const guardado = await page.evaluate(
      () => JSON.parse(localStorage.getItem('dk_registro_comercio_borrador') ?? '{}'),
    );
    expect(guardado.verticales).toEqual(['peluqueria']);
  });

  /** Con el token caducado la aplicación deja de fingir que hay sesión. */
  test('debería llevar al acceso cuando el API rechaza el token', async ({ page }) => {
    await interceptarApi(page, {
      'GET /reservas/mis': { estado: 401, cuerpo: { message: 'Unauthorized' } },
    });
    await sesionIniciada(page);

    await page.goto('/reservas');

    await expect(page).toHaveURL(/\/auth\/login\?.*motivo=sesion/);
    await expect(page.getByText(/sesión ha caducado/i)).toBeVisible();
    // Y la sesión ya no está en el dispositivo: no se repite el bucle de 401.
    expect(await page.evaluate(() => localStorage.getItem('zenda_token'))).toBeNull();
  });
});

test.describe('O2 · Búsqueda con IA', () => {
  /*
   * Regresión: sin asistente configurado el API devolvía todo vacío y el
   * frontend caía en alojamiento, perdiendo la categoría y la ciudad.
   */
  test('«Peluquería canina en Valencia» debería llevar a peluquería con la ciudad', async ({ page }) => {
    await interceptarApi(page, {
      'POST /ai-search': {
        cuerpo: {
          vertical: 'peluqueria', ciudad: 'Valencia',
          desde: null, hasta: null, presupuestoMax: null, pasajeros: null, extras: {},
          explicacion: 'Peluquerías caninas en Valencia.',
        },
      },
    });
    await page.goto('/');

    await page.getByRole('tab', { name: /buscar con ia/i }).click();
    await page.locator('.ai__input').fill('Peluquería canina en Valencia');
    await page.locator('.ai__btn').click();

    await expect(page).toHaveURL(/\/peluqueria\?.*ciudad=Valencia/);
  });

  /** Sin categoría reconocida ya no se navega a ciegas: se dice que no se entendió. */
  test('no debería caer en alojamiento cuando no reconoce la categoría', async ({ page }) => {
    await interceptarApi(page, {
      'POST /ai-search': {
        cuerpo: {
          vertical: null, ciudad: null, desde: null, hasta: null,
          presupuestoMax: null, pasajeros: null, extras: {},
          explicacion: 'No hemos sabido concretar la búsqueda; ajusta los filtros.',
        },
      },
    });
    await page.goto('/');

    await page.getByRole('tab', { name: /buscar con ia/i }).click();
    await page.locator('.ai__input').fill('algo bonito para mi perro');
    await page.locator('.ai__btn').click();

    await expect(page.locator('.ai__error')).toBeVisible();
    await expect(page).not.toHaveURL(/\/alojamiento/);
  });
});

test.describe('O5 · Veterinaria sólo publica servicios con precio cerrado', () => {
  /** Forma real de `ServicioCard`: lo que devuelve `GET /catalog/servicios`. */
  const TARJETA = {
    id: 'v1',
    nombre: 'Clínica Los Robles',
    ciudad: 'Valencia',
    precioPorNoche: 35,
    score: 4.6,
    scoreLabel: 'Muy bien',
    numResenas: 12,
    imagenes: [],
    destacado: false,
    vertical: 'veterinaria',
    extra: {
      especialidades: ['Medicina general', 'Cirugía', 'Cardiología'],
      serviciosClinicos: [
        { tipo: 'consulta_general', nombre: 'Consulta veterinaria', precio: 35 },
        { tipo: 'vacunacion', nombre: 'Vacuna de la rabia', precio: 32 },
      ],
      tiposServicioClinico: ['consulta_general', 'vacunacion'],
      precioConsulta: 35,
      atiendeUrgencias: true,
    },
  };

  const FICHA = { ...TARJETA, descripcion: 'Atención veterinaria general.', direccion: 'Calle Mayor 1' };

  const LISTADO = {
    'GET /catalog/servicios': { cuerpo: { items: [TARJETA], total: 1, page: 1, totalPages: 1 } },
  };

  test('el listado no debería anunciar «Medicina general» ni «Cirugía»', async ({ page }) => {
    await interceptarApi(page, LISTADO);
    await page.goto('/veterinaria');

    await expect(page.getByText('Clínica Los Robles').first()).toBeVisible();
    await expect(page.getByText('Medicina general')).toHaveCount(0);
    await expect(page.getByText('Cirugía', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Consulta veterinaria').first()).toBeVisible();
  });

  test('el panel de filtros debería ofrecer servicios, no especialidades', async ({ page }) => {
    await interceptarApi(page, LISTADO);
    await page.goto('/veterinaria');

    const filtros = page.locator('.rs-filtros');
    await expect(filtros).toBeVisible();
    await expect(filtros.getByText('Especialidades')).toHaveCount(0);
    await expect(filtros.getByText('Cardiología')).toHaveCount(0);
    await expect(filtros.getByRole('heading', { name: 'Servicios', exact: true })).toBeVisible();
  });

  test('la ficha debería listar los servicios con su importe', async ({ page }) => {
    await interceptarApi(page, { 'GET /catalog/servicios/*': { cuerpo: FICHA } });
    await page.goto('/veterinaria/v1');

    await expect(page.getByRole('heading', { name: /servicios con precio cerrado/i })).toBeVisible();
    /*
     * Cada servicio es ahora una fila con su importe y su botón de reservar, no
     * un chip con el precio pegado al nombre. La prueba seguía buscando aquel
     * chip —«Vacuna de la rabia · 32 €»— y fallaba por el formato, no por la
     * regla: lo que hay que garantizar es que el importe está a la vista antes
     * de ir a la clínica.
     */
    const vacuna = page.locator('[data-testid="tarifas"] .tarifa', { hasText: 'Vacuna de la rabia' });
    await expect(vacuna).toBeVisible();
    await expect(vacuna).toContainText('32');
    await expect(page.getByText('Cardiología')).toHaveCount(0);
    await expect(page.getByText('Medicina general')).toHaveCount(0);
  });
});

test.describe('O8 y O9 · Explora', () => {
  const LUGAR = {
    _id: 'l1',
    tipo: 'playa',
    nombre: 'Playa canina de Dénia',
    descripcion: 'Playa con acceso permitido a perros.',
    fotos: [],
    ubicacion: { ciudad: 'Dénia', provincia: 'Alicante' },
    ratingPromedio: 4.4,
    totalReviews: 8,
  };

  /** O8: la procedencia del dato es interna y no se enseña al visitante. */
  test('la ficha no debería mostrar la hoja de la que salió el dato', async ({ page }) => {
    await interceptarApi(page, {
      // Una ficha antigua todavía guarda la procedencia entre los atributos: el
      // filtro del cliente es la red por debajo del que ya hace el API.
      'GET /lugares/*': {
        cuerpo: {
          ...LUGAR,
          atributos: { duchas: true, comarca: 'Marina Alta', fuente: 'municipios_final.xlsx' },
        },
      },
      'GET /lugares/*/reviews': { cuerpo: [] },
    });

    await page.goto('/explora/l1');

    await expect(page.getByText('Playa canina de Dénia').first()).toBeVisible();
    await expect(page.getByText(/municipios_final/i)).toHaveCount(0);
    await expect(page.getByText(/^fuente$/i)).toHaveCount(0);
    // Y lo que sí es información del sitio sigue estando.
    await expect(page.getByText('Duchas')).toBeVisible();
  });

  /** O9: los hoteles pet-friendly se contratan; no son un sitio de la comunidad. */
  test('el bloque Explora de la portada no debería ofrecer hoteles', async ({ page }) => {
    await interceptarApi(page);
    await page.goto('/');

    const bloque = page.locator('.explora-section');
    await expect(bloque.getByText(/playas caninas/i).first()).toBeVisible();
    await expect(bloque.getByText(/hoteles pet friendly/i)).toHaveCount(0);
    await expect(bloque.locator('.explora-card')).toHaveCount(4);
  });
});
