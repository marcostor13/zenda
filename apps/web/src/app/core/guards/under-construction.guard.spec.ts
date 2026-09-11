import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Rol } from 'shared';
import { underConstructionGuard } from './under-construction.guard';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

describe('underConstructionGuard', () => {
  let router: jest.Mocked<Router>;
  let usuario: ReturnType<typeof signal<{ rol: Rol } | null>>;

  const parseUrlDevolviendo = (queryParams: Record<string, string>) =>
    ({ queryParams }) as ReturnType<Router['parseUrl']>;

  /**
   * jsdom comparte las cookies entre pruebas del mismo fichero: sin borrarla, el
   * acceso que deja una prueba hace pasar a la siguiente por la puerta buena.
   */
  const olvidarAcceso = () => {
    localStorage.clear();
    document.cookie = 'dk_acceso_anticipado=; Path=/; Max-Age=0';
  };

  beforeEach(() => {
    olvidarAcceso();
    usuario = signal<{ rol: Rol } | null>(null);
    router = {
      parseUrl: jest.fn().mockReturnValue(parseUrlDevolviendo({})),
      createUrlTree: jest.fn().mockReturnValue('/proximamente'),
    } as any;

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { usuario } },
      ],
    });
  });

  afterEach(() => {
    environment.underConstruction = false;
    olvidarAcceso();
  });

  const ejecutarGuard = (url = '/'): ReturnType<typeof underConstructionGuard> =>
    TestBed.runInInjectionContext(() => underConstructionGuard({} as any, { url } as any));

  it('debería permitir acceso directo si la app no está en modo "muy pronto"', () => {
    environment.underConstruction = false;
    expect(ejecutarGuard()).toBe(true);
  });

  it('debería permitir acceso y recordarlo si el query param trae la clave correcta', () => {
    environment.underConstruction = true;
    router.parseUrl.mockReturnValue(parseUrlDevolviendo({ acceso: environment.underConstructionKey }));

    const resultado = ejecutarGuard('/?acceso=' + environment.underConstructionKey);

    expect(resultado).toBe(true);
    expect(localStorage.getItem('dk_acceso_anticipado')).toBe('1');
    // También en cookie: es lo único que el render de servidor puede leer.
    expect(document.cookie).toContain('dk_acceso_anticipado=1');
  });

  /**
   * Quien entró con la clave antes de que esto fuera una cookie sólo lo tiene en
   * `localStorage`. Se le sigue reconociendo, y se le pone la cookie para que el
   * servidor deje de mandarle a la pantalla de espera.
   */
  it('debería reconocer el acceso guardado sólo en localStorage y ponerlo en cookie', () => {
    environment.underConstruction = true;
    localStorage.setItem('dk_acceso_anticipado', '1');

    expect(ejecutarGuard()).toBe(true);
    expect(document.cookie).toContain('dk_acceso_anticipado=1');
  });

  it('debería redirigir a /proximamente si no hay clave ni acceso guardado', () => {
    environment.underConstruction = true;

    const resultado = ejecutarGuard();

    expect(resultado).toBe('/proximamente');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/proximamente']);
  });

  it('debería redirigir a /proximamente si la clave del query param es incorrecta', () => {
    environment.underConstruction = true;
    router.parseUrl.mockReturnValue(parseUrlDevolviendo({ acceso: 'clave-equivocada' }));

    expect(ejecutarGuard('/?acceso=clave-equivocada')).toBe('/proximamente');
  });

  it('debería permitir acceso sin repetir el query param si ya quedó guardado antes', () => {
    environment.underConstruction = true;
    localStorage.setItem('dk_acceso_anticipado', '1');

    expect(ejecutarGuard()).toBe(true);
  });

  it('debería dejar pasar al comercio autenticado aunque no tenga la clave', () => {
    environment.underConstruction = true;
    usuario.set({ rol: Rol.COMERCIO_ADMIN });

    expect(ejecutarGuard('/comercio/alta')).toBe(true);
  });

  it('debería dejar pasar al administrador autenticado', () => {
    environment.underConstruction = true;
    usuario.set({ rol: Rol.ADMIN });

    expect(ejecutarGuard('/admin')).toBe(true);
  });

  it('debería redirigir a /proximamente al cliente autenticado sin clave', () => {
    environment.underConstruction = true;
    usuario.set({ rol: Rol.CLIENTE });

    expect(ejecutarGuard('/reservas')).toBe('/proximamente');
  });
});
