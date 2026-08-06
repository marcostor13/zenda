import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ListaEsperaService } from './lista-espera.service';
import { environment } from '../../../environments/environment';

describe('ListaEsperaService', () => {
  let service: ListaEsperaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ListaEsperaService],
    });
    service = TestBed.inject(ListaEsperaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería enviar el email al endpoint público de lista de espera', () => {
    let respuesta: unknown;
    service.suscribir('ana@doogking.com').subscribe((r) => (respuesta = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/lista-espera`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@doogking.com', origen: 'proximamente' });

    req.flush({ email: 'ana@doogking.com', yaRegistrado: false });
    expect(respuesta).toEqual({ email: 'ana@doogking.com', yaRegistrado: false });
  });

  it('debería permitir marcar un origen distinto', () => {
    service.suscribir('ana@doogking.com', 'instagram').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/lista-espera`);
    expect(req.request.body.origen).toBe('instagram');
    req.flush({ email: 'ana@doogking.com', yaRegistrado: false });
  });
});
