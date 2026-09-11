import { TestBed } from '@angular/core/testing';
import { ConsentimientoService, VERSION_CONSENTIMIENTO } from './consentimiento.service';
import { CookiesService } from '../plataforma/cookies.service';

describe('ConsentimientoService', () => {
  let cookies: jest.Mocked<Pick<CookiesService, 'leer' | 'escribir' | 'borrar'>>;

  const crear = (guardado: string | null = null): ConsentimientoService => {
    cookies = { leer: jest.fn().mockReturnValue(guardado), escribir: jest.fn(), borrar: jest.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ConsentimientoService, { provide: CookiesService, useValue: cookies }],
    });
    return TestBed.inject(ConsentimientoService);
  };

  it('debería quedar pendiente mientras el visitante no decide', () => {
    const service = crear(null);

    expect(service.pendiente()).toBe(true);
    expect(service.permite('analitica')).toBe(false);
  });

  /** Sin decisión, nada de terceros puede cargarse: es el punto de partida legal. */
  it('debería denegar todas las categorías mientras no haya decisión', () => {
    const service = crear(null);

    expect(service.decision()).toEqual({ preferencias: false, analitica: false, marketing: false });
  });

  describe('aceptarTodo', () => {
    it('debería permitir las tres categorías y dejar de estar pendiente', () => {
      const service = crear(null);
      service.aceptarTodo();

      expect(service.pendiente()).toBe(false);
      expect(service.permite('analitica')).toBe(true);
      expect(service.permite('marketing')).toBe(true);
    });

    it('debería guardar la decisión en cookie, que es lo que el servidor puede leer', () => {
      const service = crear(null);
      service.aceptarTodo();

      expect(cookies.escribir).toHaveBeenCalledWith(
        'dk_consentimiento', expect.stringContaining('"analitica":true'), 365,
      );
    });
  });

  describe('rechazarTodo', () => {
    it('debería dejar todo denegado pero con la decisión tomada', () => {
      const service = crear(null);
      service.rechazarTodo();

      expect(service.pendiente()).toBe(false);
      expect(service.permite('analitica')).toBe(false);
    });
  });

  describe('guardar', () => {
    it('debería respetar una elección a medida', () => {
      const service = crear(null);
      service.guardar({ preferencias: true, analitica: false, marketing: false });

      expect(service.permite('preferencias')).toBe(true);
      expect(service.permite('analitica')).toBe(false);
    });

    it('debería sellar la decisión con la fecha y la versión del texto', () => {
      const service = crear(null);
      service.guardar({ preferencias: true, analitica: false, marketing: false });

      const guardado = JSON.parse((cookies.escribir.mock.calls[0]?.[1] ?? '{}') as string);
      expect(guardado.version).toBe(VERSION_CONSENTIMIENTO);
      expect(typeof guardado.fecha).toBe('string');
    });
  });

  describe('al leer la cookie', () => {
    it('debería recuperar una decisión previa', () => {
      const service = crear(JSON.stringify({
        preferencias: true, analitica: true, marketing: false,
        fecha: '2026-09-01T00:00:00.000Z', version: VERSION_CONSENTIMIENTO,
      }));

      expect(service.pendiente()).toBe(false);
      expect(service.permite('analitica')).toBe(true);
      expect(service.permite('marketing')).toBe(false);
    });

    /**
     * El consentimiento se dio para las herramientas que había entonces: si la
     * política cambia, hay que volver a preguntar.
     */
    it('debería volver a preguntar si la política cambió de versión', () => {
      const service = crear(JSON.stringify({
        preferencias: true, analitica: true, marketing: true,
        fecha: '2026-01-01T00:00:00.000Z', version: VERSION_CONSENTIMIENTO - 1,
      }));

      expect(service.pendiente()).toBe(true);
    });

    /** Dar por hecho que aceptó ante una cookie rota sería justo lo contrario de lo seguro. */
    it('debería volver a preguntar si la cookie está corrupta', () => {
      const service = crear('esto no es json');

      expect(service.pendiente()).toBe(true);
    });

    it('debería tratar como denegado cualquier valor que no sea exactamente true', () => {
      const service = crear(JSON.stringify({
        analitica: 'sí', marketing: 1, version: VERSION_CONSENTIMIENTO,
      }));

      expect(service.permite('analitica')).toBe(false);
      expect(service.permite('marketing')).toBe(false);
    });
  });

  describe('reabrir', () => {
    it('debería olvidar la decisión y volver a preguntar', () => {
      const service = crear(JSON.stringify({
        preferencias: true, analitica: true, marketing: true,
        fecha: '2026-09-01T00:00:00.000Z', version: VERSION_CONSENTIMIENTO,
      }));

      service.reabrir();

      expect(service.pendiente()).toBe(true);
      expect(cookies.borrar).toHaveBeenCalledWith('dk_consentimiento');
    });
  });
});
