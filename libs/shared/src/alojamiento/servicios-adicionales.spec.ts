import {
  CobroServicioAdicional, cobroDeServicioAdicional, lineasServicioAdicional,
  totalServiciosAdicionales, unidadesServicioAdicional,
} from './servicios-adicionales';

const extras = [
  { nombre: 'Peluquería', precio: 25 },
  { nombre: 'Medicación', precio: 3, cobro: CobroServicioAdicional.POR_DIA_PERRO },
  { nombre: 'Paseo extra', precio: 4, cobro: CobroServicioAdicional.POR_DIA },
];

describe('servicios adicionales del alojamiento', () => {
  it('debería leer como cobro único un extra sin modo o con un modo desconocido', () => {
    expect(cobroDeServicioAdicional({})).toBe(CobroServicioAdicional.UNICO);
    expect(cobroDeServicioAdicional({ cobro: 'raro' })).toBe(CobroServicioAdicional.UNICO);
    expect(cobroDeServicioAdicional({ cobro: 'por_dia' })).toBe(CobroServicioAdicional.POR_DIA);
  });

  it('debería contar las unidades según el modo de cobro', () => {
    const estancia = { dias: 7, perros: 2 };
    expect(unidadesServicioAdicional(CobroServicioAdicional.UNICO, estancia)).toBe(1);
    expect(unidadesServicioAdicional(CobroServicioAdicional.POR_DIA, estancia)).toBe(7);
    expect(unidadesServicioAdicional(CobroServicioAdicional.POR_DIA_PERRO, estancia)).toBe(14);
  });

  it('debería contar al menos un día y un perro', () => {
    expect(unidadesServicioAdicional(CobroServicioAdicional.POR_DIA_PERRO, { dias: 0, perros: 0 })).toBe(1);
  });

  it('debería multiplicar la medicación por días y perros y la peluquería una sola vez', () => {
    const total = totalServiciosAdicionales(extras, ['Peluquería', 'Medicación'], { dias: 7, perros: 2 });
    expect(total).toBe(25 + 3 * 7 * 2);
  });

  it('debería ignorar los extras elegidos que el comercio ya no ofrece', () => {
    const lineas = lineasServicioAdicional(extras, ['No existe', 'Paseo extra'], { dias: 3, perros: 1 });
    expect(lineas).toEqual([
      { nombre: 'Paseo extra', precioUnitario: 4, cobro: CobroServicioAdicional.POR_DIA, unidades: 3, importe: 12 },
    ]);
  });

  it('debería devolver 0 sin extras elegidos', () => {
    expect(totalServiciosAdicionales(extras, [], { dias: 5, perros: 1 })).toBe(0);
  });
});
