import { etiquetaPuntuacion } from './puntuacion';

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
});
