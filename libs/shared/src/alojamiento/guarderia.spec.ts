import {
  ConfigGuarderia, ModalidadAlojamiento, TramoGuarderia, diaSemanaIso, etiquetaModalidadReserva,
  horasFacturables, modalidadesAlojamiento, motivoGuarderiaNoReservable, ofreceGuarderia, ofreceResidencia,
  precioDesdeGuarderia, precioGuarderia, tramosOfrecidos,
} from './guarderia';

const config = (parcial: Partial<ConfigGuarderia> = {}): ConfigGuarderia => ({
  precioHora: 6, precioMediaJornada: 18, precioDiaCompleto: 28,
  plazasPorDia: 10, apertura: '08:00', cierre: '19:00', diasSemana: [1, 2, 3, 4, 5],
  ...parcial,
});

describe('guardería de día', () => {
  describe('modalidadesAlojamiento', () => {
    it('debería tratar un alojamiento sin modalidades como residencia', () => {
      expect(modalidadesAlojamiento({})).toEqual([ModalidadAlojamiento.RESIDENCIA]);
      expect(modalidadesAlojamiento(null)).toEqual([ModalidadAlojamiento.RESIDENCIA]);
      expect(ofreceResidencia({ modalidades: [] })).toBe(true);
      expect(ofreceGuarderia(undefined)).toBe(false);
    });

    it('debería respetar las modalidades declaradas e ignorar valores desconocidos', () => {
      expect(modalidadesAlojamiento({ modalidades: ['guarderia', 'x', 'guarderia'] })).toEqual([ModalidadAlojamiento.GUARDERIA]);
      expect(ofreceResidencia({ modalidades: ['guarderia'] })).toBe(false);
      expect(ofreceGuarderia({ modalidades: ['residencia', 'guarderia'] })).toBe(true);
    });
  });

  describe('precioGuarderia', () => {
    it('debería cobrar las horas por el precio por hora y por perro', () => {
      expect(precioGuarderia(config(), { tramo: TramoGuarderia.HORAS, horas: 3 }, 2)).toBe(36);
    });

    it('debería cobrar media jornada y día completo a precio cerrado', () => {
      expect(precioGuarderia(config(), { tramo: TramoGuarderia.MEDIA_JORNADA })).toBe(18);
      expect(precioGuarderia(config(), { tramo: TramoGuarderia.DIA_COMPLETO }, 3)).toBe(84);
    });

    it('debería aplicar el mínimo de horas del centro', () => {
      expect(horasFacturables(config({ horasMinimas: 2 }), 1)).toBe(2);
      expect(precioGuarderia(config({ horasMinimas: 2 }), { tramo: TramoGuarderia.HORAS, horas: 0 })).toBe(12);
    });

    it('debería devolver null si el tramo no tiene precio', () => {
      expect(precioGuarderia(config({ precioHora: 0 }), { tramo: TramoGuarderia.HORAS, horas: 2 })).toBeNull();
      expect(precioGuarderia(config(), { tramo: 'otro' })).toBeNull();
    });
  });

  it('debería listar sólo los tramos con precio y calcular el «desde»', () => {
    const c = config({ precioHora: undefined });
    expect(tramosOfrecidos(c)).toEqual([TramoGuarderia.MEDIA_JORNADA, TramoGuarderia.DIA_COMPLETO]);
    expect(precioDesdeGuarderia(c)).toBe(18);
    expect(precioDesdeGuarderia(config())).toBe(6);
    expect(precioDesdeGuarderia(undefined)).toBeUndefined();
    expect(tramosOfrecidos(null)).toEqual([]);
  });

  it('debería calcular el día ISO de una fecha', () => {
    expect(diaSemanaIso('2026-10-05')).toBe(1); // lunes
    expect(diaSemanaIso('2026-10-04')).toBe(7); // domingo
  });

  describe('motivoGuarderiaNoReservable', () => {
    const lunes = '2026-10-05';

    it('debería aceptar una reserva que encaja con días y horario', () => {
      expect(motivoGuarderiaNoReservable(config(), {
        fecha: lunes, tramo: TramoGuarderia.HORAS, horas: 3, horaEntrada: '09:00',
      })).toBeNull();
      expect(motivoGuarderiaNoReservable(config({ diasSemana: [] }), {
        fecha: '2026-10-04', tramo: TramoGuarderia.DIA_COMPLETO,
      })).toBeNull();
    });

    it('debería rechazar sin plazas, sin precio o en un día cerrado', () => {
      expect(motivoGuarderiaNoReservable(undefined, { fecha: lunes, tramo: TramoGuarderia.DIA_COMPLETO })).toMatch(/plazas/);
      expect(motivoGuarderiaNoReservable(config({ precioMediaJornada: 0 }), {
        fecha: lunes, tramo: TramoGuarderia.MEDIA_JORNADA,
      })).toMatch(/modalidad/);
      expect(motivoGuarderiaNoReservable(config(), { fecha: '2026-10-04', tramo: TramoGuarderia.DIA_COMPLETO })).toMatch(/no abre/);
    });

    it('debería rechazar una entrada que no cabe en el horario', () => {
      expect(motivoGuarderiaNoReservable(config(), {
        fecha: lunes, tramo: TramoGuarderia.MEDIA_JORNADA, horaEntrada: '16:00',
      })).toMatch(/08:00 a 19:00/);
      expect(motivoGuarderiaNoReservable(config(), {
        fecha: lunes, tramo: TramoGuarderia.HORAS, horas: 1, horaEntrada: '07:00',
      })).toMatch(/horario/);
      expect(motivoGuarderiaNoReservable(config(), {
        fecha: lunes, tramo: TramoGuarderia.HORAS, horas: 1, horaEntrada: '9h',
      })).toMatch(/no es válida/);
    });
  });

  it('debería nombrar la modalidad de una reserva', () => {
    expect(etiquetaModalidadReserva({ modalidad: 'residencia' })).toBe('Residencia');
    expect(etiquetaModalidadReserva({ modalidad: 'guarderia', tramoGuarderia: 'horas', horasGuarderia: 3 }))
      .toBe('Guardería de día · Por horas (3 h)');
    expect(etiquetaModalidadReserva({ modalidad: 'guarderia', tramoGuarderia: 'media_jornada' }))
      .toBe('Guardería de día · Media jornada');
    expect(etiquetaModalidadReserva({ modalidad: 'guarderia' })).toBe('Guardería de día');
    expect(etiquetaModalidadReserva({})).toBeNull();
    expect(etiquetaModalidadReserva(undefined)).toBeNull();
  });
});
