import { distanciaKm } from './distancia';

describe('distanciaKm', () => {
  it('debería ser 0 entre un punto y sí mismo', () => {
    expect(distanciaKm({ lat: 39.47, lng: -0.38 }, { lat: 39.47, lng: -0.38 })).toBe(0);
  });

  it('debería medir Valencia–Castellón en unos 64 km', () => {
    const valencia = { lat: 39.4699, lng: -0.3763 };
    const castellon = { lat: 39.9864, lng: -0.0513 };
    expect(distanciaKm(valencia, castellon)).toBeGreaterThan(62);
    expect(distanciaKm(valencia, castellon)).toBeLessThan(67);
  });

  it('debería ser simétrica', () => {
    const a = { lat: 38.3452, lng: -0.481 };
    const b = { lat: 38.84, lng: 0.106 };
    expect(distanciaKm(a, b)).toBeCloseTo(distanciaKm(b, a), 9);
  });
});
