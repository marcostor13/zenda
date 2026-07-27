import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  /** Fija lo que responde la consulta de preferencia del sistema. */
  const conPreferenciaOscura = (oscuro: boolean): void => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: oscuro }) as unknown as typeof window.matchMedia;
  };

  const crear = (): ThemeService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ThemeService] });
    return TestBed.inject(ThemeService);
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    conPreferenciaOscura(false);
  });

  it('debería seguir la preferencia del sistema la primera vez', () => {
    conPreferenciaOscura(true);

    const service = crear();

    expect(service.darkMode()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('debería respetar la elección guardada por encima del sistema', () => {
    // El sistema pide oscuro, pero el usuario eligió claro: manda el usuario.
    conPreferenciaOscura(true);
    localStorage.setItem('zenda-theme', 'light');

    expect(crear().darkMode()).toBe(false);
  });

  it('debería alternar el tema y aplicarlo al documento', () => {
    const service = crear();

    service.toggle();

    expect(service.darkMode()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('debería recordar la elección entre sesiones', () => {
    crear().toggle();

    expect(localStorage.getItem('zenda-theme')).toBe('dark');
    expect(crear().darkMode()).toBe(true);
  });

  it('debería volver al tema claro al alternar dos veces', () => {
    const service = crear();

    service.toggle();
    service.toggle();

    expect(service.darkMode()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
