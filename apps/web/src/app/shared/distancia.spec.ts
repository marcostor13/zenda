import { kmLegibles, lugarConDistancia } from './distancia';

describe('distancias legibles', () => {
  it('debería dar un decimal cerca y redondear lejos, con coma', () => {
    expect(kmLegibles(8.44)).toBe('8,4 km');
    expect(kmLegibles(5)).toBe('5 km');
    expect(kmLegibles(23.6)).toBe('24 km');
  });

  it('debería añadir la distancia a la población sólo si la hay', () => {
    expect(lugarConDistancia('Vila-real', 8.4)).toBe('Vila-real · a 8,4 km');
    expect(lugarConDistancia('Valencia')).toBe('Valencia');
  });

  it('debería decir a cuánto está del centro cuando no es un resultado cercano', () => {
    expect(lugarConDistancia('Castellón de la Plana', undefined, 2.34)).toBe('Castellón de la Plana · a 2,3 km del centro');
  });

  it('debería preferir la distancia a la población buscada', () => {
    expect(lugarConDistancia('Vila-real', 8.4, 1.2)).toBe('Vila-real · a 8,4 km');
  });

  it('debería pasar el texto por el traductor', () => {
    const traducir = jest.fn((texto: string, params: Readonly<Record<string, string>>) =>
      texto === 'a {km} del centro' ? `${params['km']} from the centre` : texto);
    expect(lugarConDistancia('Valencia', undefined, 3, traducir)).toBe('Valencia · 3 km from the centre');
  });
});
