import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  RUTA_COMERCIOS_PROXIMAMENTE,
  RUTA_RESERVAS_PROXIMAMENTE,
  registroComerciosAbiertoGuard,
  reservasAbiertasGuard,
} from './lanzamiento.guard';

describe('guards de lanzamiento', () => {
  let router: jest.Mocked<Pick<Router, 'createUrlTree'>>;
  const arbolRedireccion = {} as UrlTree;
  const valoresOriginales = {
    reservas: environment.reservasAbiertas,
    comercios: environment.registroComerciosAbierto,
  };

  beforeEach(() => {
    router = { createUrlTree: jest.fn().mockReturnValue(arbolRedireccion) };
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: router }] });
  });

  afterEach(() => {
    environment.reservasAbiertas = valoresOriginales.reservas;
    environment.registroComerciosAbierto = valoresOriginales.comercios;
  });

  const ejecutar = (guard: typeof reservasAbiertasGuard) =>
    TestBed.runInInjectionContext(() => guard({} as never, {} as never));

  describe('reservasAbiertasGuard', () => {
    it('debería dejar pasar cuando las reservas están abiertas', () => {
      environment.reservasAbiertas = true;
      expect(ejecutar(reservasAbiertasGuard)).toBe(true);
      expect(router.createUrlTree).not.toHaveBeenCalled();
    });

    it('debería llevar a la pantalla de "muy pronto" de reservas cuando están cerradas', () => {
      environment.reservasAbiertas = false;
      expect(ejecutar(reservasAbiertasGuard)).toBe(arbolRedireccion);
      expect(router.createUrlTree).toHaveBeenCalledWith([RUTA_RESERVAS_PROXIMAMENTE]);
    });
  });

  describe('registroComerciosAbiertoGuard', () => {
    it('debería dejar pasar cuando el alta de comercios está abierta', () => {
      environment.registroComerciosAbierto = true;
      expect(ejecutar(registroComerciosAbiertoGuard)).toBe(true);
    });

    it('debería llevar a la pantalla de "muy pronto" de comercios cuando está cerrada', () => {
      environment.registroComerciosAbierto = false;
      expect(ejecutar(registroComerciosAbiertoGuard)).toBe(arbolRedireccion);
      expect(router.createUrlTree).toHaveBeenCalledWith([RUTA_COMERCIOS_PROXIMAMENTE]);
    });
  });
});
