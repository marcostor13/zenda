import { etiquetaPuntuacion, tieneValoraciones } from './puntuacion';

describe('etiquetaPuntuacion', () => {
  it('debería usar la escala de 1 a 5 de las reseñas', () => {
    expect(etiquetaPuntuacion(5)).toBe('Excepcional');
    expect(etiquetaPuntuacion(4.7)).toBe('Excepcional');
    expect(etiquetaPuntuacion(4.6)).toBe('Fabuloso');
    expect(etiquetaPuntuacion(4.4)).toBe('Fabuloso');
    expect(etiquetaPuntuacion(4.1)).toBe('Muy bueno');
    expect(etiquetaPuntuacion(3.5)).toBe('Bueno');
  });

  it('debería dejar «Correcto» para las notas bajas', () => {
    expect(etiquetaPuntuacion(3.4)).toBe('Correcto');
    expect(etiquetaPuntuacion(1)).toBe('Correcto');
  });

  it('debería decir «Sin valoraciones» cuando no hay reseñas, nunca «Correcto»', () => {
    expect(etiquetaPuntuacion(0, 0)).toBe('Sin valoraciones');
    expect(etiquetaPuntuacion(0)).toBe('Sin valoraciones');
    // Una nota heredada sin reseñas que la sostengan no es una valoración.
    expect(etiquetaPuntuacion(4.8, 0)).toBe('Sin valoraciones');
  });

  it('debería etiquetar la nota cuando sí hay reseñas', () => {
    expect(etiquetaPuntuacion(4.8, 3)).toBe('Excepcional');
    expect(etiquetaPuntuacion(2, 1)).toBe('Correcto');
  });
});

describe('tieneValoraciones', () => {
  it('debería mandar el contador sobre la nota', () => {
    expect(tieneValoraciones(4.5, 0)).toBe(false);
    expect(tieneValoraciones(0, 2)).toBe(true);
    expect(tieneValoraciones(3.2)).toBe(true);
    expect(tieneValoraciones(undefined)).toBe(false);
  });
});
