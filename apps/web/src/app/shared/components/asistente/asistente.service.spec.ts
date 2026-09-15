import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AsistenteService } from './asistente.service';

describe('AsistenteService', () => {
  let service: AsistenteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AsistenteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('debería mandar la pregunta con su contexto al asistente del API', async () => {
    const consulta = {
      pregunta: '¿Cómo reservo?',
      historial: [{ autor: 'cliente' as const, texto: 'Hola' }],
      ruta: '/peluqueria',
    };

    const respuesta = service.preguntar(consulta);
    const peticion = http.expectOne(`${environment.apiUrl}/asistente`);

    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(consulta);

    peticion.flush({ disponible: true, respuesta: 'Así.' });
    await expect(respuesta).resolves.toEqual({ disponible: true, respuesta: 'Así.' });
  });

  /* El componente pinta un aviso cuando falla: el error tiene que llegarle. */
  it('debería propagar el fallo en vez de tragárselo', async () => {
    const respuesta = service.preguntar({ pregunta: 'x' });
    http.expectOne(`${environment.apiUrl}/asistente`)
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

    await expect(respuesta).rejects.toBeTruthy();
  });
});
