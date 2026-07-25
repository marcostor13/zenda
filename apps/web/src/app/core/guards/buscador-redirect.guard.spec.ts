import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { VerticalKey } from 'shared';
import { buscadorRedirectGuard } from './buscador-redirect.guard';

describe('buscadorRedirectGuard', () => {
  let router: Router;

  const ejecutar = (queryParams: Record<string, string>) =>
    TestBed.runInInjectionContext(() =>
      buscadorRedirectGuard(
        { queryParams } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
    router = TestBed.inject(Router);
  });

  it('debería redirigir al listado del vertical pedido', () => {
    const destino = ejecutar({ vertical: VerticalKey.VETERINARIA });

    expect(router.serializeUrl(destino as never)).toBe('/veterinaria');
  });

  it('debería conservar los filtros de la búsqueda', () => {
    const destino = ejecutar({ vertical: VerticalKey.ALOJAMIENTO, ciudad: 'Madrid', desde: '2026-08-01' });

    expect(router.serializeUrl(destino as never)).toBe('/alojamiento?ciudad=Madrid&desde=2026-08-01');
  });

  it('debería llevar a alojamiento cuando no se indica vertical', () => {
    const destino = ejecutar({});

    expect(router.serializeUrl(destino as never)).toBe('/alojamiento');
  });
});
