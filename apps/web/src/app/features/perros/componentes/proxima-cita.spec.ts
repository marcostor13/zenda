import { proximaCitaDe } from './proxima-cita';
import { ExpedienteApi } from '../expediente.service';

describe('proximaCitaDe', () => {
  const ahora = new Date('2026-09-13T10:00:00Z');
  const expediente = (extra: Partial<ExpedienteApi>): ExpedienteApi =>
    ({ perro: {} as ExpedienteApi['perro'], registros: [], servicios: [], ...extra });

  it('debería devolver null sin expediente o sin fechas futuras', () => {
    expect(proximaCitaDe(null, ahora)).toBeNull();
    expect(proximaCitaDe(expediente({}), ahora)).toBeNull();
  });

  it('debería elegir la fecha futura más cercana entre reservas y citas recomendadas', () => {
    const exp = expediente({
      servicios: [
        { reservaId: 'a', codigo: 'A', vertical: 'veterinaria', comercioId: 'c', fechaInicio: '2026-10-20', estado: 'confirmada' },
        { reservaId: 'b', codigo: 'B', vertical: 'veterinaria', comercioId: 'c', fechaInicio: '2026-09-20', estado: 'cancelada' },
      ],
      registros: [
        { _id: 'r', vertical: 'veterinaria', origen: 'comercio', nota: 'x', datosEstructurados: {}, esPropio: false, proximaCita: '2026-10-01' },
      ],
    });

    expect(proximaCitaDe(exp, ahora)).toBe('2026-10-01');
  });
});
