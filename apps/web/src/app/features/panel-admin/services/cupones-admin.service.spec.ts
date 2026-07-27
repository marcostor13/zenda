import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CuponesAdminService, Cupon } from './cupones-admin.service';

describe('CuponesAdminService', () => {
  let service: CuponesAdminService;
  let httpMock: HttpTestingController;

  const resolver = (respuesta: unknown = {}) => {
    const req = httpMock.expectOne((r) => r.url.includes('/cupones'));
    req.flush(respuesta as Record<string, unknown>);
    return req.request;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CuponesAdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería listar los cupones existentes', async () => {
    const promesa = service.listar();

    const req = resolver([{ codigo: 'VERANO', tipo: 'porcentaje', valor: 10, vertical: 'alojamiento' }]);
    expect(req.method).toBe('GET');

    await expect(promesa).resolves.toHaveLength(1);
  });

  it('debería crear el cupón enviando todos sus límites', async () => {
    const cupon: Cupon = {
      codigo: 'VERANO', tipo: 'porcentaje', valor: 10, vertical: 'alojamiento',
      montoMinimo: 50, topeDescuento: 25, usoMaximo: 100, activo: true,
    };
    const promesa = service.crear(cupon);

    const req = resolver({ ...cupon, _id: 'cup1' });
    expect(req.method).toBe('POST');
    // Los topes se validan en el servidor, pero deben viajar completos:
    // perderlos crearía un cupón sin límite de descuento.
    expect(req.body).toEqual(cupon);

    await expect(promesa).resolves.toMatchObject({ _id: 'cup1' });
  });

  it('debería propagar el rechazo de un código duplicado', async () => {
    const promesa = service.crear({ codigo: 'VERANO', tipo: 'fijo', valor: 5, vertical: 'global' });
    httpMock.expectOne((r) => r.url.includes('/cupones'))
      .flush({ message: 'Código ya existe' }, { status: 409, statusText: 'Conflict' });

    await expect(promesa).rejects.toBeDefined();
  });
});
