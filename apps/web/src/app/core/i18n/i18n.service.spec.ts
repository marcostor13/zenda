import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;

  const crear = (): I18nService => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(I18nService);
  };

  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    // jsdom se identifica como `en-US`: sin fijar la elección, el servicio
    // arrancaría en inglés y los casos que no van de detección de idioma
    // medirían otra cosa.
    localStorage.setItem('doogking_idioma', 'es');
    service = crear();
  });

  describe('idioma inicial', () => {
    it('debería arrancar en español cuando no hay elección guardada ni idioma soportado en el navegador', () => {
      localStorage.clear();
      jest.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
      expect(crear().idioma()).toBe('es');
    });

    it('debería respetar la elección guardada por encima del idioma del navegador', () => {
      localStorage.setItem('doogking_idioma', 'de');
      jest.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
      expect(crear().idioma()).toBe('de');
    });

    it('debería usar el idioma del navegador la primera vez, normalizando la variante regional', () => {
      localStorage.clear();
      jest.spyOn(navigator, 'language', 'get').mockReturnValue('pt-BR');
      expect(crear().idioma()).toBe('pt');
    });
  });

  describe('t()', () => {
    it('debería devolver el propio texto en español, que es el idioma fuente', () => {
      expect(service.t('Ingresar')).toBe('Ingresar');
    });

    it('debería interpolar los parámetros del texto', () => {
      expect(service.t('Nivel {nivel}', { nivel: 'ALPHA II' })).toBe('Nivel ALPHA II');
    });

    it('debería dejar la marca intacta si falta el parámetro, en vez de escribir "undefined"', () => {
      expect(service.t('Nivel {nivel}', {})).toBe('Nivel {nivel}');
    });

    it('debería devolver el español cuando el idioma activo no tiene esa cadena traducida', async () => {
      await service.elegirIdioma('en');
      expect(service.t('Una cadena que nadie ha traducido todavía'))
        .toBe('Una cadena que nadie ha traducido todavía');
    });
  });

  describe('elegirIdioma()', () => {
    it('debería cambiar el idioma, traducir con el diccionario nuevo y recordarlo', async () => {
      await service.elegirIdioma('en');

      expect(service.idioma()).toBe('en');
      expect(service.t('Ingresar')).toBe('Sign in');
      expect(localStorage.getItem('doogking_idioma')).toBe('en');
    });

    it('debería actualizar el lang del documento para lectores de pantalla y buscadores', async () => {
      await service.elegirIdioma('fr');
      expect(document.documentElement.getAttribute('lang')).toBe('fr');
    });

    it('debería volver al español sin necesidad de descargar nada', async () => {
      await service.elegirIdioma('de');
      await service.elegirIdioma('es');

      expect(service.idioma()).toBe('es');
      expect(service.t('Ingresar')).toBe('Ingresar');
    });

    it('no debería hacer nada si ya se está en ese idioma', async () => {
      const guardar = jest.spyOn(Storage.prototype, 'setItem');
      await service.elegirIdioma('es');
      expect(guardar).not.toHaveBeenCalled();
    });
  });

  it('debería arrancar sin fallar aunque localStorage lance', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('acceso denegado');
    });
    jest.spyOn(navigator, 'language', 'get').mockReturnValue('ja-JP');
    expect(crear().idioma()).toBe('es');
  });
});
