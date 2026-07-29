import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { underConstructionGuard } from './under-construction.guard';
import { environment } from '../../../environments/environment';

describe('underConstructionGuard', () => {
  let router: jest.Mocked<Router>;

  const parseUrlDevolviendo = (queryParams: Record<string, string>) =>
    ({ queryParams }) as ReturnType<Router['parseUrl']>;

  beforeEach(() => {
    localStorage.clear();
    router = {
      parseUrl: jest.fn().mockReturnValue(parseUrlDevolviendo({})),
      createUrlTree: jest.fn().mockReturnValue('/proximamente'),
    } as any;

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });
  });

  afterEach(() => {
    environment.underConstruction = false;
    localStorage.clear();
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
});
