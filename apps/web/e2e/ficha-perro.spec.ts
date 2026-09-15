import { test, expect, interceptarApi, sesionIniciada } from './fixtures/api';

/**
 * La cabecera de la ficha del perro.
 *
 * El nombre iba en azul oscuro sobre la banda azul de la cabecera: invisible.
 * La causa eran dos números sueltos que tenían que cuadrar —la banda medía
 * 120 px y el contenido arrancaba a 64— y con "align-items: end" el bloque del
 * nombre sube cuanto más alto es, así que el titular acababa dentro del azul.
 * Un nombre largo lo dejaba entero ahí dentro, cruzado por la línea dorada.
 *
 * Lo que se vigila es lo que de verdad falla: que el titular caiga por debajo
 * de la banda, mida lo que mida el nombre.
 */

const PERRO = {
  _id: 'p1', nombre: 'Nala', raza: 'Border Collie', especie: 'perro',
  fechaNacimiento: '2021-04-12', sexo: 'hembra', peso: 18, tamano: 'mediano',
  esterilizado: true, esMestizo: false, ciudad: 'Valencia',
  fotos: ['/images/explora-parques.jpg'], tipoPelo: ['largo'],
  vacunas: [], vacunasDetalle: [{ tipo: 'rabia', fecha: '2025-03-01' }],
  alergias: [], enfermedades: [], medicacion: [], miedos: [],
  puedeQuedarseSolo: true, ansiedadSeparacion: false, seMarea: false,
  requiereTransportin: false, autorizaCompartirHistorial: true,
  certificadosUrl: [], microchip: '941000012345678',
};

const abrirFicha = async (page, nombre: string) => {
  const perro = { ...PERRO, nombre };
  await interceptarApi(page, {
    'GET /perros/*/expediente': { cuerpo: { perro, registros: [], servicios: [] } },
    'GET /perros/*/bienestar': { cuerpo: { puntuacion: 82, nivel: 'bueno', factores: [] } },
    'GET /perros/*': { cuerpo: perro },
  });
  await page.goto('/perros/p1');
  await expect(page.locator('.hero__id h1')).toHaveText(nombre);
};

/** Dónde acaba la banda azul y dónde empieza el titular. */
const medir = async (page) => {
  const banda = (await page.locator('.hero__fondo').boundingBox())!;
  const titulo = (await page.locator('.hero__id h1').boundingBox())!;
  return { finBanda: banda.y + banda.height, inicioTitulo: titulo.y };
};

test.describe('Cabecera de la ficha del perro', () => {
  test.beforeEach(async ({ page }) => {
    await sesionIniciada(page);
  });

  test('debería dejar el nombre fuera de la banda azul', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrirFicha(page, 'Nala');

    const { finBanda, inicioTitulo } = await medir(page);
    expect(inicioTitulo).toBeGreaterThanOrEqual(finBanda);
  });

  /* Es el caso que lo dejaba entero sobre el azul: cuanto más alto el bloque,
     más subía con "align-items: end". */
  test('debería seguir fuera con un nombre que ocupa toda la línea', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrirFicha(page, 'Maximiliano Bartolomeo de la Concepción');

    const { finBanda, inicioTitulo } = await medir(page);
    expect(inicioTitulo).toBeGreaterThanOrEqual(finBanda);
  });

  test('debería mantenerlo fuera también en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirFicha(page, 'Maximiliano Bartolomeo');

    const { finBanda, inicioTitulo } = await medir(page);
    expect(inicioTitulo).toBeGreaterThanOrEqual(finBanda);
  });

  /* El avatar sí pisa la banda: es el patrón de foto de perfil, y sin él la
     cabecera pierde lo que la hace reconocible. */
  test('debería dejar el avatar a caballo de la banda', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrirFicha(page, 'Nala');

    const banda = (await page.locator('.hero__fondo').boundingBox())!;
    const avatar = (await page.locator('.hero__avatar').boundingBox())!;

    expect(avatar.y).toBeLessThan(banda.y + banda.height);
    expect(avatar.y + avatar.height).toBeGreaterThan(banda.y + banda.height);
  });
});
