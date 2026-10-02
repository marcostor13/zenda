import { precioDesdeServicio } from './precio-desde';

describe('precioDesdeServicio', () => {
  it('alojamiento: debería ser el espacio más barato, no el precio orientativo', () => {
    const servicio = {
      vertical: 'alojamiento',
      precioBase: 25,
      extra: { espacios: [{ precioNoche: 40 }, { precioNoche: 32 }, { precioNoche: 55, disponible: false }] },
    };
    expect(precioDesdeServicio(servicio)).toBe(32);
  });

  it('peluquería: debería ser el servicio de grooming más barato que esté activo', () => {
    expect(precioDesdeServicio({
      vertical: 'peluqueria', precioBase: 10,
      extra: { serviciosGrooming: [{ precio: 30 }, { precio: 18, activo: false }, { precio: 22 }] },
    })).toBe(22);
  });

  it('veterinaria y adiestramiento: deberían contar la consulta/sesión y los servicios', () => {
    expect(precioDesdeServicio({
      vertical: 'veterinaria', precioBase: 99,
      extra: { precioConsulta: 40, serviciosClinicos: [{ precio: 15 }] },
    })).toBe(15);
    expect(precioDesdeServicio({
      vertical: 'adiestramiento', precioBase: 99, extra: { precioSesion: 35 },
    })).toBe(35);
  });

  it('funerarios: debería contar los tramos de peso', () => {
    expect(precioDesdeServicio({
      vertical: 'funerarios', precioBase: 0,
      extra: { serviciosFunerarios: [{ precioBase: 120, tramosPeso: [{ hastaKg: 5, precio: 90 }] }] },
    })).toBe(90);
  });

  it('debería caer al precio base cuando no hay productos con precio', () => {
    expect(precioDesdeServicio({ vertical: 'alojamiento', precioBase: 25, extra: { espacios: [] } })).toBe(25);
    expect(precioDesdeServicio({ vertical: 'desconocido', precioBase: 12 })).toBe(12);
    expect(precioDesdeServicio({ vertical: 'peluqueria' })).toBe(0);
  });

  it('debería ser idempotente: aplicarlo sobre su propio resultado no cambia nada', () => {
    const extra = { espacios: [{ precioNoche: 40 }, { precioNoche: 32 }] };
    const desde = precioDesdeServicio({ vertical: 'alojamiento', precioBase: 25, extra });
    expect(precioDesdeServicio({ vertical: 'alojamiento', precioBase: desde, extra })).toBe(desde);
  });
});
