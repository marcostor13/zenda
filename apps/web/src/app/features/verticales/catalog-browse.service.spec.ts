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
      const promesa = service.buscar('peluqueria', 'Madrid');

      const req = httpMock.expectOne(
        (r) => r.url.includes('/catalog/servicios') && r.params.get('vertical') === 'peluqueria',
      );
      expect(req.request.params.get('ciudad')).toBe('Madrid');
      req.flush({ items: [{ ...cardMock, extra: undefined }], total: 1, page: 1, totalPages: 1 });

      const resultado = await promesa;
      expect(resultado).toHaveLength(1);
      expect(resultado[0].extra).toEqual({});
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
