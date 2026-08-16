import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VerticalKey } from 'shared';
import { TransporteService } from './transporte.service';

const cardApi = (extra: Record<string, unknown> = {}) => ({
  id: 't1', nombre: 'DogVan Madrid', ciudad: 'Madrid', comercioId: 'c1',
  imagenes: ['/img/van.jpg'], precioPorNoche: 30, destacado: false,
  score: 9, scoreLabel: 'Excepcional', numResenas: 12,
  extra,
});

describe('TransporteService', () => {
  let service: TransporteService;
  let httpMock: HttpTestingController;

  const responder = (items: unknown[]) => {
    const req = httpMock.expectOne((r) => r.url.includes('/catalog/servicios'));
    req.flush({ items, total: items.length, page: 1, totalPages: 1 });
    return req.request;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TransporteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería acotar la búsqueda al vertical de transporte', async () => {
    const promesa = service.buscar();

    const req = responder([]);
    expect(req.params.get('vertical')).toBe(VerticalKey.TRANSPORTE);
    expect(req.params.has('ciudad')).toBe(false);

    await promesa;
  });

  it('debería propagar la ciudad cuando se indica', async () => {
    // `buscar` recibe las opciones de búsqueda, no la ciudad suelta: el filtro
    // se comparte con el resto de verticales desde CatalogBrowseService.
    const promesa = service.buscar({ ciudad: 'Madrid' });

    expect(responder([]).params.get('ciudad')).toBe('Madrid');
    await promesa;
  });

  it('debería mapear los campos propios del vertical', async () => {
    const promesa = service.buscar();
    responder([cardApi({
      tipoVehiculo: 'van_acondicionada', capacidadPerros: 4,
      zonaCobertura: ['Madrid', 'Toledo'], tarifaBase: 25, tarifaKm: 0.9,
      jaulasIncluidas: true, acompananteHumano: true,
    })]);

    const [card] = await promesa;
    expect(card).toMatchObject({
      tipoVehiculo: 'van_acondicionada', capacidadPerros: 4, tarifaKm: 0.9, jaulasIncluidas: true,
    });
    expect(card.zonaCobertura).toEqual(['Madrid', 'Toledo']);
  });

  it('debería caer al precio base cuando el comercio no declaró tarifa', async () => {
    const promesa = service.buscar();
    responder([cardApi()]);

    const [card] = await promesa;
    // Sin `tarifaBase` propia se usa el precio del servicio, no un cero.
    expect(card.tarifaBase).toBe(30);
    expect(card.tarifaKm).toBe(0);
  });

  it('debería rellenar valores seguros si faltan campos del vertical', async () => {
    const promesa = service.buscar();
    responder([cardApi()]);

    const [card] = await promesa;
    expect(card.tipoVehiculo).toBe('coche');
    expect(card.capacidadPerros).toBe(1);
    expect(card.zonaCobertura).toEqual([]);
    expect(card.jaulasIncluidas).toBe(false);
  });

  it('debería tomar la primera imagen y tolerar que no haya ninguna', async () => {
    const promesa = service.buscar();
    responder([{ ...cardApi(), imagenes: undefined }]);

    const [card] = await promesa;
    expect(card.imagen).toBe('');
  });
});
