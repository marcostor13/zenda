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
});
