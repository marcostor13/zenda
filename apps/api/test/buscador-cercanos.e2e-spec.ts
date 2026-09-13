import { VerticalKey } from 'shared';
import { crearAppE2E, ruta, type AppE2E } from './utils/app-e2e';
import { api, sembrarComercio } from './utils/admin-e2e';
import { GeoService } from '../src/core/geo/geo.service';

/**
 * E2E de la búsqueda sin resultados: quien busca en una población donde no hay
 * nada ve lo más cercano, como en Booking. «Castellón» sin servicios propone el
 * centro canino de Vila-real, a unos kilómetros, en lugar de un listado vacío.
 */
describe('Buscador: lo más cercano a una población sin resultados (e2e)', () => {
  let e2e: AppE2E;
  const geocodificador = { coordenadasDePoblacion: jest.fn() };

  // [lng, lat] como GeoJSON.
  const VILA_REAL = [-0.1008, 39.9383];
  const ONDA = [-0.2597, 39.9625];
  const MADRID = [-3.7038, 40.4168];
  const CASTELLON = { ciudad: 'Castellón de la Plana', lat: 39.9864, lng: -0.0513 };

  beforeAll(async () => {
    // El geocodificador real llamaría a Google u OpenStreetMap.
    e2e = await crearAppE2E([{ token: GeoService, valor: geocodificador }]);
  }, 180_000);

  afterAll(async () => {
    await e2e.cerrar();
  });

  beforeEach(async () => {
    await e2e.limpiarBaseDeDatos();
    geocodificador.coordenadasDePoblacion.mockReset().mockResolvedValue(CASTELLON);
  });

  async function clinicaEn(nombre: string, ciudad: string, coordenadas: number[], estado = 'publicado'): Promise<void> {
    const { servicioId } = await sembrarComercio(e2e, { nombreComercial: nombre, vertical: VerticalKey.VETERINARIA });
    await e2e.conexion.collection('servicios').updateOne({ _id: servicioId }, {
      $set: {
        titulo: nombre, estado, citasDisponibles: 5,
        ubicacion: { ciudad, geo: { type: 'Point', coordinates: coordenadas } },
      },
    });
  }

  function buscar(ciudad: string, extra: Record<string, string> = {}) {
    return api(e2e).get(ruta('/catalog/servicios')).query({ vertical: 'veterinaria', ciudad, ...extra }).expect(200);
  }

  it('debería proponer lo más cercano, de más cerca a más lejos, sin salir del radio', async () => {
    await clinicaEn('Clínica Onda', 'Onda', ONDA);
    await clinicaEn('Centro canino Vila-can', 'Vila-real', VILA_REAL);
    await clinicaEn('Clínica Retiro', 'Madrid', MADRID);

    const { body } = await buscar('Castellón');

    expect(body.items.map((s: { nombre: string }) => s.nombre)).toEqual(['Centro canino Vila-can', 'Clínica Onda']);
    expect(body.total).toBe(2);
    expect(body.cercanos).toMatchObject({
      radioKm: 60,
      masCercano: { nombre: 'Centro canino Vila-can', ciudad: 'Vila-real' },
    });
    expect(body.cercanos.ciudadBuscada).toMatch(/^Castell/);
    expect(body.cercanos.masCercano.distanciaKm).toBeGreaterThan(5);
    expect(body.cercanos.masCercano.distanciaKm).toBeLessThan(9);
    expect(body.items[0].distanciaKm).toBe(body.cercanos.masCercano.distanciaKm);
    expect(geocodificador.coordenadasDePoblacion).toHaveBeenCalledWith('Castellón');
  });

  it('debería ubicar la población con sus fichas aunque no estén publicadas, sin geocodificar', async () => {
    await clinicaEn('Centro canino Vila-can', 'Vila-real', VILA_REAL);
    await clinicaEn('Clínica en obras', 'Castellón de la Plana', [CASTELLON.lng, CASTELLON.lat], 'borrador');

    const { body } = await buscar('Castellón de la Plana');

    expect(body.cercanos.masCercano.nombre).toBe('Centro canino Vila-can');
    expect(geocodificador.coordenadasDePoblacion).not.toHaveBeenCalled();
  });

  it('no debería tocar una búsqueda con resultados ni inventar cercanos si no hay nada cerca', async () => {
    await clinicaEn('Centro canino Vila-can', 'Vila-real', VILA_REAL);

    const conResultados = await buscar('Vila-real');
    expect(conResultados.body.cercanos).toBeUndefined();
    expect(conResultados.body.items).toHaveLength(1);

    geocodificador.coordenadasDePoblacion.mockResolvedValue({ ciudad: 'Madrid', lat: MADRID[1], lng: MADRID[0] });
    const lejos = await buscar('Madrid');
    expect(lejos.body).toMatchObject({ items: [], total: 0 });
    expect(lejos.body.cercanos).toBeUndefined();
  });

  it('debería respetar los demás filtros al buscar alrededor', async () => {
    await clinicaEn('Centro canino Vila-can', 'Vila-real', VILA_REAL);

    const { body } = await buscar('Castellón', { precioMax: '10' });

    expect(body.items).toEqual([]);
    expect(body.cercanos).toBeUndefined();
  });
});
