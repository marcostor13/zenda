import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PasoEmbudo, TipoEvento } from 'shared';
import { EventosService } from './eventos.service';

describe('EventosService', () => {
  let service: EventosService;
  let httpMock: HttpTestingController;

  /** Primer cuerpo enviado a /eventos, ya parseado. */
  const cuerpoEnviado = (): Record<string, unknown> => {
    const req = httpMock.expectOne((r) => r.url.endsWith('/eventos'));
    req.flush({});
    return req.request.body as Record<string, unknown>;
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('debería arrancar el embudo y registrar el inicio de búsqueda', () => {
    service.iniciarEmbudo('alojamiento');

    const cuerpo = cuerpoEnviado();
    expect(cuerpo['tipo']).toBe(TipoEvento.BUSQUEDA_INICIADA);
    expect(cuerpo['vertical']).toBe('alojamiento');
    expect(sessionStorage.getItem('doogking_embudo_inicio')).toBeTruthy();
  });

  it('no debería reiniciar el cronómetro si el embudo ya está en marcha', () => {
    service.iniciarEmbudo();
    cuerpoEnviado();
    const inicio = sessionStorage.getItem('doogking_embudo_inicio');

    service.iniciarEmbudo();

    expect(sessionStorage.getItem('doogking_embudo_inicio')).toBe(inicio);
    httpMock.expectNone((r) => r.url.endsWith('/eventos'));
  });

  it('debería medir el tiempo transcurrido desde el inicio del embudo', () => {
    service.iniciarEmbudo();
    cuerpoEnviado();

    service.registrar(TipoEvento.PASO_COMPLETADO, { paso: PasoEmbudo.PAGO });

    const cuerpo = cuerpoEnviado();
    expect(cuerpo['msDesdeInicio']).toBeGreaterThanOrEqual(0);
    expect(cuerpo['paso']).toBe(PasoEmbudo.PAGO);
  });

  it('no debería medir tiempo si el embudo nunca empezó', () => {
    service.registrar(TipoEvento.SERVICIO_ABIERTO);

    expect(cuerpoEnviado()['msDesdeInicio']).toBeUndefined();
  });

  it('debería reutilizar el mismo identificador de visitante entre eventos', () => {
    service.registrar(TipoEvento.SERVICIO_ABIERTO);
    const primero = cuerpoEnviado()['sesionId'];

    service.registrar(TipoEvento.RESERVA_INICIADA);

    expect(cuerpoEnviado()['sesionId']).toBe(primero);
  });

  it('debería cerrar el embudo al confirmar, para que la próxima cuente de cero', () => {
    service.iniciarEmbudo();
    cuerpoEnviado();

    service.cerrarEmbudo('reserva-1', 'alojamiento');

    const cuerpo = cuerpoEnviado();
    expect(cuerpo['tipo']).toBe(TipoEvento.RESERVA_CONFIRMADA);
    expect(cuerpo['reservaId']).toBe('reserva-1');
    expect(sessionStorage.getItem('doogking_embudo_inicio')).toBeNull();
  });

  it('no debería propagar un fallo de la medición al flujo de reserva', () => {
    expect(() => service.registrar(TipoEvento.RESERVA_INICIADA)).not.toThrow();

    const req = httpMock.expectOne((r) => r.url.endsWith('/eventos'));
    // El API falla y la aplicación sigue como si nada.
    expect(() => req.flush({}, { status: 500, statusText: 'Server Error' })).not.toThrow();
  });
});
