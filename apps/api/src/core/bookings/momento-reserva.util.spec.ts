import { conHoraReal, inicioDeLaReserva, tramoDeLaReserva } from './momento-reserva.util';

describe('momento de la reserva', () => {
  const citaAntigua = {
    fechaInicio: new Date('2026-09-21T00:00:00Z'),
    detalle: { hora: '10:00', servicio: 'Vacunación' } as Record<string, unknown>,
  };

  it('debería reconstruir la hora de Madrid de una cita antigua guardada a medianoche', () => {
    expect(inicioDeLaReserva(citaAntigua)).toEqual({
      inicio: new Date('2026-09-21T08:00:00.000Z'), conHora: true,
    });
  });

  it('debería dar una hora por defecto a una cita sin duración y la guardada si la hay', () => {
    expect(tramoDeLaReserva(citaAntigua).fin.toISOString()).toBe('2026-09-21T09:00:00.000Z');
    expect(tramoDeLaReserva({ ...citaAntigua, detalle: { hora: '10:00', duracionMin: 45 } }).fin.toISOString())
      .toBe('2026-09-21T08:45:00.000Z');
  });

  it('debería respetar el fin guardado y dejar el día entero a lo que no tiene hora', () => {
    const fin = new Date('2026-09-21T10:00:00Z');
    expect(tramoDeLaReserva({ fechaInicio: new Date('2026-09-21T08:00:00Z'), fechaFin: fin }).fin).toBe(fin);
    expect(tramoDeLaReserva({ fechaInicio: new Date('2026-09-21T00:00:00Z') }).fin.toISOString())
      .toBe('2026-09-22T00:00:00.000Z');
  });

  it('debería corregir la respuesta de una cita antigua y no tocar las demás', () => {
    const antigua = { ...citaAntigua, detalle: { ...citaAntigua.detalle } };
    expect(conHoraReal(antigua)).toMatchObject({
      fechaInicio: new Date('2026-09-21T08:00:00.000Z'),
      fechaFin: new Date('2026-09-21T09:00:00.000Z'),
    });

    const estancia = { fechaInicio: new Date('2026-09-21T00:00:00Z'), fechaFin: new Date('2026-09-23T00:00:00Z') };
    expect(conHoraReal(estancia)).toBe(estancia);
    expect(estancia.fechaInicio.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });
});
