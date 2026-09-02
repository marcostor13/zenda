import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { idiomaInterceptor } from './idioma.interceptor';

describe('idiomaInterceptor', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    // jsdom se identifica como 'en-US'; se fija el idioma fuente para que la
    // prueba mida la traducción y no la detección del navegador.
    localStorage.setItem('doogking_idioma', 'es');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idiomaInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
    i18n = TestBed.inject(I18nService);
  });

  afterEach(() => controlador.verify());

  it('debería añadir el idioma activo en Accept-Language', () => {
    http.get('/api/servicios').subscribe();

    const peticion = controlador.expectOne('/api/servicios');
    expect(peticion.request.headers.get('Accept-Language')).toBe('es');
    peticion.flush({});
  });

  it('debería reflejar el idioma elegido por el usuario', async () => {
    await i18n.elegirIdioma('fr');
    http.get('/api/servicios').subscribe();

    const peticion = controlador.expectOne('/api/servicios');
    expect(peticion.request.headers.get('Accept-Language')).toBe('fr');
    peticion.flush({});
  });

  it('no debería pisar un Accept-Language que la petición ya traiga', () => {
    http.get('/api/servicios', { headers: new HttpHeaders({ 'Accept-Language': 'it' }) }).subscribe();

    const peticion = controlador.expectOne('/api/servicios');
    expect(peticion.request.headers.get('Accept-Language')).toBe('it');
    peticion.flush({});
  });
});
