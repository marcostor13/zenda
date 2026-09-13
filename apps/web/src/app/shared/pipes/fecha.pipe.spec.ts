import { TestBed } from '@angular/core/testing';
import { LOCALE_ID } from '@angular/core';
import { FechaPipe } from './fecha.pipe';

describe('FechaPipe', () => {
  let pipe: FechaPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'es' }] });
    pipe = TestBed.runInInjectionContext(() => new FechaPipe());
  });

  it('debería pintar la hora de Madrid en verano y en invierno, sea cual sea la zona del equipo', () => {
    expect(pipe.transform('2026-09-20T08:00:00.000Z', 'HH:mm')).toBe('10:00');
    expect(pipe.transform('2026-12-20T09:00:00.000Z', 'HH:mm')).toBe('10:00');
  });

  it('debería mantener el día de una fecha guardada a medianoche UTC', () => {
    expect(pipe.transform('2026-09-20T00:00:00.000Z', 'd/M/yyyy')).toBe('20/9/2026');
  });

  it('debería respetar una zona explícita', () => {
    expect(pipe.transform('2026-09-20T08:00:00.000Z', 'HH:mm', 'UTC')).toBe('08:00');
  });

  it('debería devolver null sin valor y no romperse con una fecha inválida', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform('')).toBeNull();
    expect(() => pipe.transform('no-es-fecha', 'HH:mm')).toThrow();
  });
});
