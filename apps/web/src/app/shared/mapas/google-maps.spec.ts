import { enlaceComoLlegar, enlaceGoogleMaps, tieneCoordenadas } from './google-maps';

describe('google-maps', () => {
  const madrid = { lat: 40.4148, lng: -3.6873, nombre: 'Villa Canina Retiro' };

  it('debería construir el enlace de búsqueda con las coordenadas', () => {
    expect(enlaceGoogleMaps(madrid)).toBe(
      'https://www.google.com/maps/search/?api=1&query=40.4148%2C-3.6873',
    );
  });

  it('debería construir el enlace de ruta hasta el negocio', () => {
    expect(enlaceComoLlegar(madrid)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=40.4148%2C-3.6873',
    );
  });

  it('debería preferir las coordenadas a la dirección escrita', () => {
    // Una calle con el mismo nombre existe en media España; el punto exacto no.
    const url = enlaceGoogleMaps({ ...madrid, direccion: 'Calle Mayor 1', ciudad: 'Soria' });

    expect(url).toContain('40.4148');
    expect(url).not.toContain('Soria');
  });

  it('debería caer a la dirección cuando el negocio no tiene coordenadas', () => {
    const url = enlaceGoogleMaps({
      nombre: 'Peluquería Guau', direccion: 'Calle de Velázquez 45', ciudad: 'Madrid',
    });

    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('Peluquería Guau, Calle de Velázquez 45, Madrid'),
    );
  });

  it('debería devolver null si no hay nada con lo que localizar el sitio', () => {
    expect(enlaceGoogleMaps({})).toBeNull();
    expect(enlaceComoLlegar({})).toBeNull();
  });

  it('no debería buscar sólo por el nombre del negocio', () => {
    // Sin calle ni ciudad, "Villa Canina" abriría un mapa del mundo entero.
    expect(enlaceGoogleMaps({ nombre: 'Villa Canina' })).toBeNull();
  });

  it('debería reconocer si el punto se puede situar en el mapa', () => {
    expect(tieneCoordenadas(madrid)).toBe(true);
    expect(tieneCoordenadas({ lat: 40.4, lng: undefined })).toBe(false);
    // NaN es lo que llega cuando Places no resuelve la población elegida.
    expect(tieneCoordenadas({ lat: NaN, lng: NaN })).toBe(false);
  });
});
