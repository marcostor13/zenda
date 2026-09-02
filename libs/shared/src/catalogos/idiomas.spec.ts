import {
  IDIOMAS_SOPORTADOS, IDIOMA_DEFAULT, esIdiomaSoportado, idiomaUi, normalizarIdioma,
} from './idiomas';

describe('Catálogo de idiomas', () => {
  it('debería cubrir las ocho lenguas más habladas de la UE', () => {
    expect(IDIOMAS_SOPORTADOS.map((i) => i.codigo)).toEqual(
      ['es', 'en', 'de', 'fr', 'it', 'pt', 'pl', 'nl'],
    );
  });

  it('debería tener el español como idioma fuente', () => {
    expect(IDIOMA_DEFAULT).toBe('es');
  });

  describe('normalizarIdioma()', () => {
    it('debería aceptar el código de dos letras', () => {
      expect(normalizarIdioma('de')).toBe('de');
    });

    it('debería recortar la variante regional del navegador', () => {
      expect(normalizarIdioma('de-AT')).toBe('de');
      expect(normalizarIdioma('pt_BR')).toBe('pt');
    });

    it('debería aceptar mayúsculas', () => {
      expect(normalizarIdioma('FR')).toBe('fr');
    });

    it('debería devolver null para un idioma no soportado, para que decida quien llama', () => {
      expect(normalizarIdioma('ja')).toBeNull();
      expect(normalizarIdioma(null)).toBeNull();
      expect(normalizarIdioma('')).toBeNull();
    });
  });

  describe('esIdiomaSoportado()', () => {
    it('debería distinguir un código soportado de uno que no lo está', () => {
      expect(esIdiomaSoportado('pl')).toBe(true);
      expect(esIdiomaSoportado('sv')).toBe(false);
      expect(esIdiomaSoportado(undefined)).toBe(false);
    });
  });

  describe('idiomaUi()', () => {
    it('debería devolver la ficha del idioma con su nombre nativo', () => {
      expect(idiomaUi('nl').nombre).toBe('Nederlands');
    });

    it('debería caer al idioma fuente cuando el código no existe', () => {
      expect(idiomaUi('xx').codigo).toBe('es');
    });
  });
});
