import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';

describe('authInterceptor', () => {
  let token: string | null;
  let siguiente: jest.Mock<ReturnType<HttpHandlerFn>, [HttpRequest<unknown>]>;

  /** Ejecuta el interceptor dentro del contexto de inyección que necesita. */
  function interceptar(peticion: HttpRequest<unknown>): void {
    TestBed.runInInjectionContext(() => {
      authInterceptor(peticion, siguiente as unknown as HttpHandlerFn).subscribe();
    });
  }

  const peticionEnviada = (): HttpRequest<unknown> => siguiente.mock.calls[0][0];

  beforeEach(() => {
    token = null;
    siguiente = jest.fn().mockReturnValue(of({} as HttpEvent<unknown>));

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { token: () => token } }],
    });
  });

  it('debería dejar pasar la petición sin tocarla si no hay sesión', () => {
    const original = new HttpRequest('GET', '/api/v1/catalog');

    interceptar(original);

    expect(peticionEnviada()).toBe(original);
    expect(peticionEnviada().headers.has('Authorization')).toBe(false);
  });

  it('debería añadir el Bearer cuando hay token', () => {
    token = 'jwt-de-prueba';

    interceptar(new HttpRequest('GET', '/api/v1/users/me'));

    expect(peticionEnviada().headers.get('Authorization')).toBe('Bearer jwt-de-prueba');
  });

  it('no debería mutar la petición original', () => {
    // Angular exige que las peticiones sean inmutables: mutarla rompe reintentos
    // y cualquier otro interceptor de la cadena.
    token = 'jwt-de-prueba';
    const original = new HttpRequest('POST', '/api/v1/reservas', {});

    interceptar(original);

    expect(original.headers.has('Authorization')).toBe(false);
    expect(peticionEnviada()).not.toBe(original);
  });

  it('debería conservar el resto de cabeceras', () => {
    token = 'jwt-de-prueba';
    const original = new HttpRequest('GET', '/api/v1/catalog', {
      headers: new HttpRequest('GET', '/x').headers.set('X-Origen', 'buscador'),
    });

    interceptar(original);

    expect(peticionEnviada().headers.get('X-Origen')).toBe('buscador');
    expect(peticionEnviada().headers.get('Authorization')).toBe('Bearer jwt-de-prueba');
  });

  it('debería tratar el token vacío como ausencia de sesión', () => {
    token = '';

    interceptar(new HttpRequest('GET', '/api/v1/catalog'));

    expect(peticionEnviada().headers.has('Authorization')).toBe(false);
  });
});
