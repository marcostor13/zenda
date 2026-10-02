import { precioDesde } from './precio-desde';

describe('precioDesde', () => {
  it('debería dar el servicio más barato del catálogo, igual que el API', () => {
    const peluqueria = { precioPorNoche: 10, extra: { serviciosGrooming: [{ precio: 30 }, { precio: 22 }] } };
    expect(precioDesde('peluqueria')(peluqueria)).toBe(22);
  });

  it('debería caer al precio de la tarjeta cuando no hay productos con precio', () => {
    expect(precioDesde('hoteles')({ precioPorNoche: 80, extra: {} })).toBe(80);
  });
});
