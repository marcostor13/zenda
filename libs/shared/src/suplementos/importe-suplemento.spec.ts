import { diasCobrablesReserva, importeSuplemento, unidadesSuplemento } from './importe-suplemento';

describe('importeSuplemento', () => {
  it('debería contar 2 días de viernes a domingo aunque la salida sea antes de la hora de entrada', () => {
    expect(diasCobrablesReserva('2026-11-27T13:00:00Z', '2026-11-29T10:00:00Z')).toBe(2);
  });

  it('debería contar 1 día una reserva sin salida o del mismo día', () => {
    expect(diasCobrablesReserva('2026-11-27T08:00:00Z')).toBe(1);
    expect(diasCobrablesReserva('2026-11-27T08:00:00Z', '2026-11-27T18:00:00Z')).toBe(1);
    expect(diasCobrablesReserva('no es una fecha', '2026-11-27T18:00:00Z')).toBe(1);
  });

  it('debería sumar una vez el suplemento fijo', () => {
    expect(unidadesSuplemento('fijo', 4)).toBe(1);
    expect(importeSuplemento(10, 'fijo', 4)).toBe(10);
    expect(importeSuplemento(10, undefined, 4)).toBe(10);
  });

  it('debería multiplicar por los días el suplemento por día o por noche', () => {
    expect(importeSuplemento(5, 'por_dia', 3)).toBe(15);
    expect(importeSuplemento(2.5, 'por_noche', 3)).toBe(7.5);
  });
});
