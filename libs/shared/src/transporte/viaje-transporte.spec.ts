import { TamanoPerro } from '../enums/perro.enum';
import { SolicitudViaje } from './solicitud-viaje';
import { NecesidadTransporte } from './transporte.enums';
import {
  FranjaTransporte, ModalidadTransporte, ModoHorarioTransporte, PatronRecurrenciaTransporte,
} from './viaje.catalogo';
import {
  MAX_OCURRENCIAS_SERIE, diaDeLaSemana, diasDelPatron, horaDeRecogida, horasHasta, hoyEnZona, instanteDeRecogida,
  ocurrenciasDeSerie, siguienteDia, viajesDeLaSolicitud,
} from './viaje-transporte';

const solicitud = (extra: Partial<SolicitudViaje> = {}): SolicitudViaje => ({
  tipoServicio: NecesidadTransporte.SOLO_IDA,
  origen: { texto: 'Castellón' },
  destino: { texto: 'Valencia' },
  fecha: '2026-10-01',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:30',
  mascotas: [{ especie: 'perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.COMPARTIDO,
  preferencias: [],
  ...extra,
});

describe('horaDeRecogida', () => {
  it('debería devolver la hora elegida cuando es una hora concreta', () => {
    expect(horaDeRecogida({ modoHorario: ModoHorarioTransporte.HORA_CONCRETA, hora: '10:30' })).toBe('10:30');
  });

  it('debería devolver null si la hora concreta no trae hora', () => {
    expect(horaDeRecogida({ modoHorario: ModoHorarioTransporte.HORA_CONCRETA })).toBeNull();
  });

  it('debería usar la hora de referencia de la franja cuando el cliente es flexible', () => {
    expect(horaDeRecogida({ modoHorario: ModoHorarioTransporte.FLEXIBLE, franja: FranjaTransporte.TARDE })).toBe('17:00');
  });

  it('debería usar la franja «cualquiera» si el flexible no trae franja', () => {
    expect(horaDeRecogida({ modoHorario: ModoHorarioTransporte.FLEXIBLE })).toBe('09:00');
  });

  it('debería devolver null para «lo antes posible»', () => {
    expect(horaDeRecogida({ modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE })).toBeNull();
  });
});

describe('instanteDeRecogida', () => {
  it('debería interpretar la hora en Europe/Madrid en horario de verano', () => {
    const instante = instanteDeRecogida({ fecha: '2026-10-01', modoHorario: ModoHorarioTransporte.HORA_CONCRETA, hora: '10:30' });
    expect(instante.toISOString()).toBe('2026-10-01T08:30:00.000Z');
  });

  it('debería interpretar la hora en Europe/Madrid en horario de invierno', () => {
    const instante = instanteDeRecogida({ fecha: '2026-12-01', modoHorario: ModoHorarioTransporte.HORA_CONCRETA, hora: '10:30' });
    expect(instante.toISOString()).toBe('2026-12-01T09:30:00.000Z');
  });

  it('debería devolver el instante de la petición para «lo antes posible»', () => {
    const ahora = new Date('2026-10-01T12:00:00Z');
    const instante = instanteDeRecogida({ fecha: '2026-10-05', modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE }, ahora);
    expect(instante).toBe(ahora);
  });
});

describe('diasDelPatron', () => {
  it('debería devolver todos los días para el patrón diario', () => {
    expect(diasDelPatron(PatronRecurrenciaTransporte.DIARIO, [])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('debería devolver de lunes a viernes para laborables', () => {
    expect(diasDelPatron(PatronRecurrenciaTransporte.LABORABLES, [0])).toEqual([1, 2, 3, 4, 5]);
  });

  it('debería devolver una lista vacía para el mensual', () => {
    expect(diasDelPatron(PatronRecurrenciaTransporte.MENSUAL, [1])).toEqual([]);
  });

  it('debería quitar duplicados y ordenar los días elegidos', () => {
    expect(diasDelPatron(PatronRecurrenciaTransporte.PERSONALIZADO, [5, 1, 5, 3])).toEqual([1, 3, 5]);
  });
});

describe('ocurrenciasDeSerie', () => {
  it('debería devolver los días de la semana elegidos después del primero, fin incluido', () => {
    // 2026-10-01 es jueves; lunes (1) y miércoles (3) hasta el 14.
    expect(ocurrenciasDeSerie('2026-10-01', { diasSemana: [1, 3], fechaFin: '2026-10-14' }))
      .toEqual(['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']);
  });

  it('debería devolver una lista vacía si la fecha fin es el propio primer día', () => {
    expect(ocurrenciasDeSerie('2026-10-01', { diasSemana: [4], fechaFin: '2026-10-01' })).toEqual([]);
  });

  it('debería repetir el mismo día de cada mes en el mensual', () => {
    expect(ocurrenciasDeSerie('2026-10-10', { diasSemana: [], fechaFin: '2026-12-10', mensual: true }))
      .toEqual(['2026-11-10', '2026-12-10']);
  });

  it('debería caer en el último día del mes cuando el día 31 no existe', () => {
    expect(ocurrenciasDeSerie('2026-01-31', { diasSemana: [], fechaFin: '2026-05-31', mensual: true }))
      .toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('debería cruzar de año en el mensual', () => {
    expect(ocurrenciasDeSerie('2026-12-15', { diasSemana: [], fechaFin: '2027-01-31', mensual: true }))
      .toEqual(['2027-01-15']);
  });

  it('debería cortar la serie semanal en el tope + 1 para que quien llama detecte el exceso', () => {
    const dias = ocurrenciasDeSerie('2026-01-01', { diasSemana: [0, 1, 2, 3, 4, 5, 6], fechaFin: '2030-01-01' });
    expect(dias).toHaveLength(MAX_OCURRENCIAS_SERIE + 1);
  });

  it('debería cortar la serie mensual en el tope + 1', () => {
    const dias = ocurrenciasDeSerie('2026-01-15', { diasSemana: [], fechaFin: '2040-01-01', mensual: true });
    expect(dias).toHaveLength(MAX_OCURRENCIAS_SERIE + 1);
  });
});

describe('viajesDeLaSolicitud', () => {
  it('debería contar un viaje si la solicitud no es recurrente', () => {
    expect(viajesDeLaSolicitud(solicitud())).toBe(1);
  });

  it('debería contar un viaje si es recurrente pero no trae recurrencia', () => {
    expect(viajesDeLaSolicitud(solicitud({ tipoServicio: NecesidadTransporte.RECURRENTE }))).toBe(1);
  });

  it('debería contar el primero más las ocurrencias de laborables', () => {
    const viajes = viajesDeLaSolicitud(solicitud({
      tipoServicio: NecesidadTransporte.RECURRENTE,
      recurrencia: { patron: PatronRecurrenciaTransporte.LABORABLES, diasSemana: [], hora: '10:30', hasta: '2026-10-09' },
    }));
    // jue 1 + vie 2, lun 5, mar 6, mié 7, jue 8, vie 9.
    expect(viajes).toBe(7);
  });

  it('debería contar la serie mensual', () => {
    const viajes = viajesDeLaSolicitud(solicitud({
      tipoServicio: NecesidadTransporte.RECURRENTE,
      recurrencia: { patron: PatronRecurrenciaTransporte.MENSUAL, diasSemana: [], hora: '10:30', hasta: '2026-12-31' },
    }));
    expect(viajes).toBe(3);
  });

  it('debería limitar la serie al tope de ocurrencias', () => {
    const viajes = viajesDeLaSolicitud(solicitud({
      tipoServicio: NecesidadTransporte.RECURRENTE,
      recurrencia: { patron: PatronRecurrenciaTransporte.DIARIO, diasSemana: [], hora: '10:30', hasta: '2030-01-01' },
    }));
    expect(viajes).toBe(MAX_OCURRENCIAS_SERIE + 1);
  });
});

describe('utilidades de calendario', () => {
  it('debería avanzar un día cruzando fin de mes y de año', () => {
    expect(siguienteDia('2026-02-28')).toBe('2026-03-01');
    expect(siguienteDia('2026-12-31')).toBe('2027-01-01');
  });

  it('debería calcular el día de la semana en el calendario del comercio', () => {
    expect(diaDeLaSemana('2026-10-01')).toBe(4);
    expect(diaDeLaSemana('2026-10-04')).toBe(0);
  });

  it('debería calcular las horas que faltan hasta un instante', () => {
    const ahora = new Date('2026-10-01T10:00:00Z');
    expect(horasHasta(new Date('2026-10-01T13:30:00Z'), ahora)).toBe(3.5);
    expect(horasHasta(new Date('2026-10-01T09:00:00Z'), ahora)).toBe(-1);
  });

  it('debería usar el momento actual si no se le pasa', () => {
    expect(horasHasta(new Date(Date.now() + 3_600_000))).toBeCloseTo(1, 2);
    expect(hoyEnZona()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('debería dar el día de hoy en hora de Madrid aunque en UTC aún sea ayer', () => {
    expect(hoyEnZona(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02');
  });
});
