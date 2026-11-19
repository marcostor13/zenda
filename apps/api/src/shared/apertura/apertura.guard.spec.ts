import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../exceptions/domain.exception';
import { APERTURA_KEY, Apertura, AperturaGuard, RequiereApertura } from './apertura.guard';

describe('AperturaGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  const entorno = process.env;
  const CLAVES = ['NODE_ENV', Apertura.RESERVAS, Apertura.REGISTRO_COMERCIOS] as const;
  const originales = Object.fromEntries(CLAVES.map((clave) => [clave, process.env[clave]]));
  let guard: AperturaGuard;

  const contexto = {
    getHandler: () => function handler() {},
    getClass: () => class Controlador {},
  } as unknown as ExecutionContext;

  beforeEach(() => {
    CLAVES.forEach((clave) => delete entorno[clave]);
    entorno.NODE_ENV = 'production';
    reflector = { getAllAndOverride: jest.fn() };
    guard = new AperturaGuard(reflector as unknown as Reflector);
  });

  afterEach(() => {
    CLAVES.forEach((clave) => {
      const original = originales[clave];
      if (original === undefined) delete entorno[clave];
      else entorno[clave] = original;
    });
  });

  it('debería dejar pasar los endpoints sin marca de apertura', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('debería dejar pasar cuando la fase está abierta con "true"', () => {
    reflector.getAllAndOverride.mockReturnValue(Apertura.RESERVAS);
    entorno.RESERVAS_ABIERTAS = 'true';
    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('debería aceptar "1" como abierta', () => {
    entorno.REGISTRO_COMERCIOS_ABIERTO = '1';
    expect(guard.estaAbierta(Apertura.REGISTRO_COMERCIOS)).toBe(true);
  });

  it('debería rechazar con 503 cuando las reservas están cerradas', () => {
    reflector.getAllAndOverride.mockReturnValue(Apertura.RESERVAS);
    entorno.RESERVAS_ABIERTAS = 'false';

    expect(() => guard.canActivate(contexto)).toThrow(DomainException);
    try {
      guard.canActivate(contexto);
    } catch (error) {
      expect((error as DomainException).statusCode).toBe(503);
      expect((error as DomainException).message).toContain('reservas abren muy pronto');
    }
  });

  it('debería rechazar el alta de negocios cerrada con su propio mensaje', () => {
    reflector.getAllAndOverride.mockReturnValue(Apertura.REGISTRO_COMERCIOS);
    expect(() => guard.canActivate(contexto)).toThrow('registro de negocios abre muy pronto');
  });

  it('debería tratar la variable sin declarar como cerrada en producción', () => {
    expect(guard.estaAbierta(Apertura.RESERVAS)).toBe(false);
  });

  it('debería tratar la variable sin declarar como abierta fuera de producción', () => {
    entorno.NODE_ENV = 'development';
    entorno.RESERVAS_ABIERTAS = '';
    expect(guard.estaAbierta(Apertura.RESERVAS)).toBe(true);
  });

  it('debería guardar la fase en los metadatos del endpoint', () => {
    class Controlador {
      @RequiereApertura(Apertura.RESERVAS)
      crear(): void {}
    }
    const metadato: unknown = Reflect.getMetadata(APERTURA_KEY, Controlador.prototype.crear);
    expect(metadato).toBe(Apertura.RESERVAS);
  });
});
