import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * La ficha del comercio como la ve el cliente: lo primero que tiene que poder
 * hacer es reservar.
 *
 * Antes el sitio de honor de la columna lo ocupaban las ocho líneas de la
 * garantía —idénticas en toda la web— y los servicios se pintaban como
 * etiquetas sueltas: sin precio, sin duración y sin forma de reservar uno
 * concreto. El precio vivía en un panel que decía "Desde 25 € desde" y no
 * había manera de saber si quedaba hueco sin entrar al asistente.
 */

const PELUQUERIA = {
  id: 's-pelu', nombre: 'Guau Style', ciudad: 'Valencia', comercioId: 'c-pelu',
  barrio: 'Ruzafa', direccion: 'Carrer de Sueca 12',
  precioPorNoche: 25, score: 4.7, scoreLabel: 'Excelente', numResenas: 128,
  imagenes: [], destacado: false, amenities: [], cancelacionGratis: true,
  descripcion: 'Salón de peluquería canina.', horario: [], excepcionesHorario: [],
  resenas: [
    { id: 'r1', autorNombre: 'Ana', puntuacion: 5, comentario: 'Genial', fecha: '2026-08-01',
      aspectos: { resultado: 5, tratoAlPerro: 4, puntualidad: 5 } },
  ],
  extra: {
    serviciosGrooming: [
      { nombre: 'Baño e higiene', precio: 25, duracionMin: 45 },
      { nombre: 'Corte de pelo', precio: 40, duracionMin: 90 },
    ],
  },
};

const AGENDA = {
  soportado: true, duracionMin: 45,
  dias: [{ fecha: '2030-09-16', estado: 'libre', huecosLibres: 4, primeraHora: '10:00' }],
  primeraLibre: { fecha: '2030-09-16', hora: '10:00' },
};

test.describe('Ficha de un comercio', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: PELUQUERIA },
      'GET /reservas/huecos/agenda': { cuerpo: AGENDA },
    });
  });

  test('debería poner delante lo que decide la reserva: servicio, precio y cuándo hay hueco', async ({ page }) => {
    await page.goto('/peluqueria/s-pelu');

    // Cada servicio con su precio y su duración, no una etiqueta suelta.
    const tarifas = page.getByTestId('tarifas');
    await expect(tarifas.getByText('Corte de pelo')).toBeVisible();
    await expect(tarifas.getByText('40 €')).toBeVisible();
    await expect(tarifas.getByText('1 h 30 min')).toBeVisible();

    // La respuesta a "¿cuándo puedo?", sin entrar al asistente.
    await expect(page.getByTestId('proxima-cita')).toContainText('10:00');

    // La garantía, una sola vez.
    await expect(page.locator('rs-trust-block')).toHaveCount(1);

    // Y sin el "Desde … desde" que arrastraba el panel de peluquería.
    await expect(page.locator('.side-panel')).not.toContainText('desde');
  });

  test('debería llevar al asistente con el servicio elegido en la ficha', async ({ page }) => {
    await page.goto('/peluqueria/s-pelu');

    await page.getByTestId('tarifas').getByRole('button', { name: 'Reservar' }).nth(1).click();

    await expect(page).toHaveURL(/\/reservas\/peluqueria\/s-pelu/);
    await expect(page).toHaveURL(/servicio=Corte\+de\+pelo|servicio=Corte%20de%20pelo/);
    // El paso 1 abre con ese servicio ya puesto: no hay que volver a buscarlo.
    await expect(page.locator('select[formcontrolname="servicio"]')).toHaveValue('Corte de pelo');
  });

  test('debería dejar la acción de reservar siempre a la vista en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/peluqueria/s-pelu');

    const barra = page.locator('.mobile-cta');
    await expect(barra.getByRole('button', { name: 'Reservar cita' })).toBeInViewport();

    // Sin bajar nada: la acción está desde el primer momento.
    await page.mouse.wheel(0, 4000);
    await expect(barra.getByRole('button', { name: 'Reservar cita' })).toBeInViewport();
  });
});

/**
 * Las dos fichas de detalle —la de alojamiento y la común al resto de
 * categorías— reparten la pantalla igual. Eran dos componentes distintos que
 * habían ido separándose: panel con tipografías distintas, galería a todo lo
 * ancho encima del cuerpo en una y en la otra, y la garantía por duplicado en
 * ambas. Cambiar de categoría no puede cambiar la pantalla.
 */
const ESPACIO = {
  id: 'e1', tipo: 'suite', descripcion: 'Suite climatizada', tamanoMaxPerro: 'grande',
  precioNoche: 45, cantidad: 2, disponible: true, amenities: ['Climatización'],
  imagenes: [], cancelacionGratis: true,
};

const ALOJAMIENTO = {
  id: 'a1', nombre: 'El Refugio', ciudad: 'Valencia', barrio: 'Paterna', direccion: 'Camí 24',
  comercioId: 'c1', score: 4.8, scoreLabel: 'Excelente', numResenas: 214,
  precioPorNoche: 28, imagenes: ['/images/porque-verificados.jpg'], amenities: ['Piscina canina'],
  cancelacionGratis: true, paseosIncluidos: true, espaciosDisponibles: 2, destacado: false,
  descripcion: 'Residencia con parcela vallada.', politicaCancelacion: 'Gratis hasta 48 h antes.',
  checkIn: '09:00', checkOut: '12:00', requisitoVacunas: true, camaras24h: true,
  requisitoMicrochip: false, requiereDesparasitacionInterna: false,
  requiereDesparasitacionExterna: false, requiereVacunaTosPerreras: false,
  compatibilidadSocialAdmitida: [], serviciosAdicionales: [], horario: [], excepcionesHorario: [],
  espacios: [ESPACIO], resenas: [],
};

test.describe('Las dos fichas reparten la pantalla igual', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  const comprobarReparto = async (page, selectorPanel: string) => {
    // La galería vive dentro de la columna, alineada con el contenido, y el
    // panel ocupa el hueco de su derecha desde la primera pantalla.
    const galeria = page.locator('.info-col .gallery');
    await expect(galeria).toBeVisible();

    const caja = (await galeria.boundingBox())!;
    const panel = (await page.locator(selectorPanel).boundingBox())!;
    expect(panel.x).toBeGreaterThan(caja.x + caja.width - 2);

    // El titular, delante de las fotos.
    const titulo = (await page.locator('.info-header__name').boundingBox())!;
    expect(titulo.y).toBeLessThan(caja.y);

    // Y el botón, pulsable sin bajar nada.
    await expect(page.locator(`${selectorPanel} .rs-btn--gold`)).toBeInViewport();
    await expect(page.locator(`${selectorPanel} .rs-btn--gold`)).toBeEnabled();

    // La garantía, una sola vez en toda la ficha.
    await expect(page.locator('rs-trust-block')).toHaveCount(1);
  };

  test('la ficha de una categoría de cita', async ({ page }) => {
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: { ...PELUQUERIA, imagenes: ['/images/porque-verificados.jpg'] } },
      'GET /reservas/huecos/agenda': { cuerpo: AGENDA },
    });
    await page.goto('/peluqueria/s-pelu');

    await comprobarReparto(page, '.side-panel');
  });

  test('la ficha de alojamiento', async ({ page }) => {
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: ALOJAMIENTO },
      'GET /reservas/disponibilidad/calendario': { cuerpo: { soportado: true, dias: [] } },
    });
    await page.goto('/alojamiento/a1');

    await comprobarReparto(page, '.booking-panel__card');
    // Y su gancho propio: los espacios que de verdad quedan.
    await expect(page.getByTestId('aviso-escasez')).toContainText('2 espacios');
  });
});

/**
 * Lo que la ficha tiene que saber recortar: una clínica con veinte tarifas, un
 * negocio con festivos apuntados y una galería con cinco fotos en una fila
 * pensada para seis.
 */
test.describe('La ficha recorta lo que sobra', () => {
  const tarifa = (i: number) => ({ nombre: `Servicio ${i}`, precio: 20 + i, duracionMin: 30 });

  const CLINICA = {
    ...PELUQUERIA,
    id: 's-vet', nombre: 'Clínica Sanabria', vertical: 'veterinaria',
    imagenes: ['/images/porque-verificados.jpg', '/images/porque-atencion.jpg',
      '/images/explora-playas.jpg', '/images/explora-parques.jpg', '/images/explora-restaurantes.jpg'],
    horario: [{ dia: 'lunes', cerrado: false, abre: '09:00', cierra: '20:00' }],
    excepcionesHorario: [
      { fecha: '2030-12-25', cerrado: true, motivo: 'Navidad' },
      { fecha: '2030-01-01', cerrado: true, motivo: 'Año nuevo' },
    ],
    extra: { serviciosClinicos: Array.from({ length: 9 }, (_, i) => tarifa(i + 1)) },
  };

  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await interceptarApi(page, {
      'GET /catalog/servicios/*': { cuerpo: CLINICA },
      'GET /reservas/huecos/agenda': { cuerpo: AGENDA },
    });
    await page.goto('/veterinaria/s-vet');
  });

  test('debería enseñar cinco servicios y ofrecer el resto a un toque', async ({ page }) => {
    const filas = page.locator('[data-testid="tarifas"] .tarifa');
    await expect(filas).toHaveCount(5);

    const verMas = page.getByTestId('ver-mas-tarifas');
    await expect(verMas).toContainText('4');

    await verMas.click();
    await expect(filas).toHaveCount(9);
    await expect(verMas).toContainText('Ver menos');

    await verMas.click();
    await expect(filas).toHaveCount(5);
  });

  test('debería traer los días especiales plegados, sin tapar la semana', async ({ page }) => {
    const bloque = page.getByTestId('dias-especiales');
    await expect(bloque).toContainText('(2)');
    // Plegado: el detalle no se ve hasta abrirlo.
    await expect(bloque.getByText('Navidad')).toBeHidden();

    await bloque.locator('summary').click();
    await expect(bloque.getByText('Navidad')).toBeVisible();
  });

  test('no debería dejar hueco en la fila de miniaturas con cinco fotos', async ({ page }) => {
    const fila = (await page.locator('.gallery__thumbs').boundingBox())!;
    const ultima = (await page.locator('.gallery__thumb').last().boundingBox())!;

    // La última acaba donde acaba la fila: sin casilla vacía al final.
    expect(Math.round(ultima.x + ultima.width)).toBeCloseTo(Math.round(fila.x + fila.width), -1);
  });

  test('debería dejar el mapa bajo el panel, sin que el rail desborde la pantalla', async ({ page }) => {
    const mapa = (await page.locator('.side-mapa').boundingBox())!;
    const panel = (await page.locator('.side-panel').boundingBox())!;
    expect(mapa.y).toBeGreaterThan(panel.y + panel.height - 2);

    /*
     * Y en un portátil corriente el rail no se queda pegado y recortado.
     *
     * Antes se le ponía un tope de alto para que cupiera siempre; ahora puede
     * medir lo que mida y es el pegado el que cede, así que lo que se comprueba
     * es la regla, no el tamaño: pegado sólo si cabe entero bajo la cabecera.
     */
    await page.setViewportSize({ width: 1440, height: 768 });
    const rail = page.locator('.side-col');
    const estado = await rail.evaluate((el) => ({
      pegado: getComputedStyle(el).position === 'sticky',
      alto: el.getBoundingClientRect().height,
    }));

    if (estado.pegado) expect(estado.alto).toBeLessThanOrEqual(768 - 84);
  });
});
