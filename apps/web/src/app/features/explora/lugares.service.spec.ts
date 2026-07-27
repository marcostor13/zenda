import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TipoLugar } from 'shared';
import { LugaresService } from './lugares.service';

describe('LugaresService', () => {
  let service: LugaresService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LugaresService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('no debería enviar filtros vacíos en la consulta', async () => {
    const promesa = service.buscar();

    const req = httpMock.expectOne((r) => r.url.endsWith('/lugares'));
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush([]);

    await promesa;
  });

  it('debería propagar tipo, ciudad y coordenadas', async () => {
    const promesa = service.buscar({ tipo: TipoLugar.PLAYA, ciudad: 'Cádiz', lat: 36.5, lng: -6.2 });

    const req = httpMock.expectOne((r) => r.url.endsWith('/lugares'));
    expect(req.request.params.get('tipo')).toBe(TipoLugar.PLAYA);
    expect(req.request.params.get('ciudad')).toBe('Cádiz');
    expect(req.request.params.get('lat')).toBe('36.5');
    expect(req.request.params.get('lng')).toBe('-6.2');
    req.flush([]);

    await promesa;
  });

  it('debería enviar el cero como valor válido en el radio', async () => {
    const promesa = service.buscar({ radioKm: 0 });

    const req = httpMock.expectOne((r) => r.url.endsWith('/lugares'));
    expect(req.request.params.get('radioKm')).toBe('0');
    req.flush([]);

    await promesa;
  });

  it('debería pedir la ficha y las opiniones por separado', async () => {
    const ficha = service.obtener('l1');
    httpMock.expectOne((r) => r.url.endsWith('/lugares/l1')).flush({ _id: 'l1' });
    await ficha;

    const reviews = service.reviews('l1');
    httpMock.expectOne((r) => r.url.endsWith('/lugares/l1/reviews')).flush([]);
    await reviews;
  });

  it('debería enviar la aportación al endpoint del lugar', async () => {
    const promesa = service.aportar('l1', { puntuacion: 5, texto: 'Genial' });

    const req = httpMock.expectOne((r) => r.url.endsWith('/lugares/l1/reviews'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ puntuacion: 5 });
    req.flush({ _id: 'rev1' });

    await promesa;
  });
});
