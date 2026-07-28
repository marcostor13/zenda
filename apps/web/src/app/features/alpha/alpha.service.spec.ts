import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AlphaService, AlphaEstadoApi, AlphaNivelApi } from './alpha.service';
import { environment } from '../../../environments/environment';

describe('AlphaService', () => {
  let service: AlphaService;
  let httpMock: HttpTestingController;

  const nivelesMock: AlphaNivelApi[] = [
    { nivel: 1, nombre: 'Alpha 1', reservasRequeridas: 0, descuentoPct: 0, beneficios: ['Promos'] },
  ];

  const estadoMock: AlphaEstadoApi = {
    nivelActual: 1,
    nombreNivel: 'Alpha 1',
    descuentoPct: 0,
    beneficios: ['Promos'],
    reservasCompletadas: 2,
    reservasParaSiguiente: 3,
    siguienteNivel: { nivel: 2, nombre: 'Alpha 2', reservasRequeridas: 5, descuentoPct: 0.05, beneficios: [] },
    esMaximoNivel: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AlphaService],
    });
    service = TestBed.inject(AlphaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería listar la escalera de niveles con GET /alpha/niveles', async () => {
    const promesa = service.niveles();

    const req = httpMock.expectOne(`${environment.apiUrl}/alpha/niveles`);
    expect(req.request.method).toBe('GET');
    req.flush(nivelesMock);

    expect(await promesa).toEqual(nivelesMock);
  });

  it('debería obtener el estado Alpha del usuario con GET /alpha/mi-estado', async () => {
    const promesa = service.miEstado();

    const req = httpMock.expectOne(`${environment.apiUrl}/alpha/mi-estado`);
    expect(req.request.method).toBe('GET');
    req.flush(estadoMock);

    expect(await promesa).toEqual(estadoMock);
  });
});
