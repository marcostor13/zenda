import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CatalogBrowseService, ServicioCard } from './catalog-browse.service';

describe('CatalogBrowseService', () => {
  let service: CatalogBrowseService;
  let httpMock: HttpTestingController;

  const cardMock: ServicioCard = {
    id: 's1',
    nombre: 'Real Grooming',
    ciudad: 'Madrid',
    comercioId: 'c1',
    precioPorNoche: 25,
    score: 4.8,
    scoreLabel: 'Excepcional',
    numResenas: 12,
    imagenes: [],
    destacado: false,
    vertical: 'peluqueria',
    extra: { serviciosGrooming: [{ nombre: 'Baño', precio: 25 }] },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CatalogBrowseService],
    });

    service = TestBed.inject(CatalogBrowseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('buscar', () => {
    it('debería consultar el catálogo con el vertical indicado y normalizar "extra"', async () => {
      const promesa = service.buscar('peluqueria', { ciudad: 'Madrid' });

      const req = httpMock.expectOne(
        (r) => r.url.includes('/catalog/servicios') && r.params.get('vertical') === 'peluqueria',
      );
      expect(req.request.params.get('ciudad')).toBe('Madrid');
      expect(req.request.params.get('perroId')).toBeNull();
      req.flush({ items: [{ ...cardMock, extra: undefined }], total: 1, page: 1, totalPages: 1 });

      const resultado = await promesa;
      expect(resultado).toHaveLength(1);
      expect(resultado[0].extra).toEqual({});
    });
  });

  describe('buscarPaginado', () => {
    /** Lanza la búsqueda, resuelve la petición y devuelve los params que viajaron. */
    const paramsDe = async (
      opciones: Parameters<CatalogBrowseService['buscarPaginado']>[1],
    ): Promise<Record<string, string>> => {
      const promesa = service.buscarPaginado('alojamiento', opciones);
      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios'));
      req.flush({ items: [cardMock], total: 1, page: 1, totalPages: 1 });
      await promesa;
      return req.request.params.keys().reduce<Record<string, string>>(
        (acc, k) => ({ ...acc, [k]: req.request.params.get(k)! }), {},
      );
    };

    it('debería pedir 20 por página mientras no se diga otra cosa', async () => {
      expect(await paramsDe({})).toEqual({ vertical: 'alojamiento', limit: '20' });
    });

    it('no debería mandar la página cuando es la primera', async () => {
      expect(await paramsDe({ page: 1 })).not.toHaveProperty('page');
    });

    it('debería mandar la página a partir de la segunda', async () => {
      expect(await paramsDe({ page: 3, limit: 40 })).toMatchObject({ page: '3', limit: '40' });
    });

    it('debería mandar orden y coordenadas cuando se ordena por distancia', async () => {
      expect(await paramsDe({ orden: 'distancia', lat: 39.47, lng: -0.37 })).toMatchObject({
        orden: 'distancia', lat: '39.47', lng: '-0.37',
      });
    });

    /* El 0 es una coordenada válida (meridiano de Greenwich), no un "sin valor". */
    it('debería mandar una coordenada que vale cero', async () => {
      expect(await paramsDe({ lat: 0, lng: 0 })).toMatchObject({ lat: '0', lng: '0' });
    });

    it('debería filtrar por mascota, precio, valoración y servicios', async () => {
      expect(await paramsDe({
        perroId: 'p1', precioMin: 20, precioMax: 90, ratingMin: 4,
        amenities: ['Jardín vallado', 'Paseos diarios'],
      })).toMatchObject({
        perroId: 'p1', precioMin: '20', precioMax: '90', ratingMin: '4',
        amenities: 'Jardín vallado,Paseos diarios',
      });
    });

    it('no debería mandar la lista de servicios cuando está vacía', async () => {
      expect(await paramsDe({ amenities: [] })).not.toHaveProperty('amenities');
    });

    it('debería aplanar los filtros propios del vertical', async () => {
      expect(await paramsDe({
        filtrosVertical: { tipoVehiculo: ['van', 'furgon'], atiendeUrgencias: true },
      })).toMatchObject({ tipoVehiculo: 'van,furgon', atiendeUrgencias: 'true' });
    });

    /* Si el usuario arrastró el mapa, quiere ver lo que hay ahí, no en la ciudad escrita. */
    it('debería preferir la zona del mapa sobre la ciudad escrita', async () => {
      const params = await paramsDe({
        ciudad: 'Madrid', zona: { swLat: 1, swLng: 2, neLat: 3, neLng: 4 },
      });

      expect(params).toMatchObject({ swLat: '1', swLng: '2', neLat: '3', neLng: '4' });
      expect(params).not.toHaveProperty('ciudad');
    });

    it('debería conservar el total para el contador del listado', async () => {
      const promesa = service.buscarPaginado('alojamiento');
      httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios'))
        .flush({ items: [cardMock], total: 57, page: 2, totalPages: 3 });

      await expect(promesa).resolves.toMatchObject({ total: 57, page: 2, totalPages: 3 });
    });

    it('debería aguantar una respuesta sin items', async () => {
      const promesa = service.buscarPaginado('alojamiento');
      httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios'))
        .flush({ total: 0, page: 1, totalPages: 0 });

      await expect(promesa).resolves.toMatchObject({ items: [] });
    });
  });

  describe('puntosMapa', () => {
    it('debería pedir los pines con los mismos filtros que la lista, sin paginar', async () => {
      const promesa = service.puntosMapa('alojamiento', { ciudad: 'Valencia', ratingMin: 4 });

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/mapa'));
      expect(req.request.params.get('ciudad')).toBe('Valencia');
      expect(req.request.params.get('ratingMin')).toBe('4');
      expect(req.request.params.get('limit')).toBeNull();
      req.flush([]);

      await expect(promesa).resolves.toEqual([]);
    });
  });

  describe('facetas', () => {
    it('debería pedir el histograma de la ciudad buscada', async () => {
      const promesa = service.facetas('alojamiento', 'Valencia');

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/facetas'));
      expect(req.request.params.get('ciudad')).toBe('Valencia');
      req.flush({ precios: [], amenities: [], valoracion: [] });

      await promesa;
    });

    it('no debería mandar ciudad cuando no se indica', async () => {
      const promesa = service.facetas('alojamiento');

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/facetas'));
      expect(req.request.params.get('ciudad')).toBeNull();
      req.flush({ precios: [], amenities: [], valoracion: [] });

      await promesa;
    });
  });

  describe('obtener', () => {
    it('debería pedir el detalle por id y normalizar "extra"', async () => {
      const promesa = service.obtener('s1');

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/s1'));
      req.flush(cardMock);

      const detalle = await promesa;
      expect(detalle.nombre).toBe('Real Grooming');
      expect(detalle.extra['serviciosGrooming']).toEqual([{ nombre: 'Baño', precio: 25 }]);
    });

    it('debería devolver "extra" vacío si el backend no lo informa', async () => {
      const promesa = service.obtener('s1');

      const req = httpMock.expectOne((r) => r.url.endsWith('/catalog/servicios/s1'));
      req.flush({ ...cardMock, extra: undefined });

      const detalle = await promesa;
      expect(detalle.extra).toEqual({});
    });
  });
});
