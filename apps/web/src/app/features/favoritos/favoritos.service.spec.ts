import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { FavoritosService } from './favoritos.service';

describe('FavoritosService', () => {
  let service: FavoritosService;
  let httpMock: HttpTestingController;

  const crear = (autenticado = true): void => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { estaAutenticado: () => autenticado } },
      ],
    });
    service = TestBed.inject(FavoritosService);
    httpMock = TestBed.inject(HttpTestingController);
  };

  /** Deja el servicio con los ids indicados ya cargados. */
  const conIds = async (ids: string[]): Promise<void> => {
    const promesa = service.cargarIds();
    httpMock.expectOne((r) => r.url.endsWith('/favoritos/ids')).flush(ids);
    await promesa;
  };

  beforeEach(() => crear());

  it('debería empezar sin favoritos', () => {
    expect(service.count()).toBe(0);
    expect(service.esFavorito('s1')).toBe(false);
  });

  it('no debería consultar el API sin sesión iniciada', async () => {
    crear(false);

    await service.cargarIds();

    httpMock.expectNone((r) => r.url.includes('/favoritos'));
  });

  it('debería cachear los ids y no volver a pedirlos', async () => {
    await conIds(['s1', 's2']);

    expect(service.count()).toBe(2);
    expect(service.esFavorito('s1')).toBe(true);

    await service.cargarIds();
    httpMock.expectNone((r) => r.url.endsWith('/favoritos/ids'));
  });

  it('debería dejar el listado vacío si el API falla, sin romper la pantalla', async () => {
    const promesa = service.cargarIds();
    httpMock.expectOne((r) => r.url.endsWith('/favoritos/ids'))
      .flush({}, { status: 500, statusText: 'Server Error' });
    await promesa;

    expect(service.count()).toBe(0);
  });

  it('debería marcar como favorito de forma optimista', async () => {
    const promesa = service.toggle('s1');

    // El corazón se pinta antes de que responda el API.
    expect(service.esFavorito('s1')).toBe(true);

    const req = httpMock.expectOne((r) => r.url.endsWith('/favoritos/s1'));
    expect(req.request.method).toBe('POST');
    req.flush({});

    await expect(promesa).resolves.toBe(true);
  });

  it('debería quitar el favorito con DELETE', async () => {
    await conIds(['s1']);

    const promesa = service.toggle('s1');
    const req = httpMock.expectOne((r) => r.url.endsWith('/favoritos/s1'));
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    await promesa;
    expect(service.esFavorito('s1')).toBe(false);
  });

  it('debería revertir el corazón si la llamada falla', async () => {
    const promesa = service.toggle('s1');
    httpMock.expectOne((r) => r.url.endsWith('/favoritos/s1'))
      .flush({}, { status: 500, statusText: 'Server Error' });

    await expect(promesa).resolves.toBe(false);
    expect(service.esFavorito('s1')).toBe(false);
  });

  it('debería listar los favoritos enriquecidos', async () => {
    const promesa = service.listar();
    httpMock.expectOne((r) => r.url.endsWith('/favoritos')).flush([{ servicioId: 's1' }]);

    await expect(promesa).resolves.toHaveLength(1);
  });
});
