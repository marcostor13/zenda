import { HorarioDiaDto } from '../dtos/comunes/horario.dto';
import {
  comprobarEntradaYSalida, describirProblemaEstancia, diaCerrado, diaEnPalabras, diasAbiertosCercanos, horasDeAtencion,
} from './horario-estancia';

const laborable = (dia: string): HorarioDiaDto => ({ dia, abre: '09:00', cierra: '14:00', cerrado: false });
const cerrado = (dia: string): HorarioDiaDto => ({ dia, cerrado: true });

/** Lunes a viernes de 9 a 14; fin de semana cerrado. */
const servicio = {
  horario: [
    laborable('lunes'), laborable('martes'), laborable('miercoles'), laborable('jueves'), laborable('viernes'),
    cerrado('sabado'), cerrado('domingo'),
  ],
  excepcionesHorario: [{ fecha: '2026-10-12', cerrado: true, motivo: 'Fiesta nacional' }],
};

// 2026-10-02 es viernes; el 3 y el 4, fin de semana; el 5, lunes.
const HOY = '2026-10-01';

describe('horario de entrega y recogida de una estancia', () => {
  it('debería dejar pasar una estancia que entra y sale en días de atención', () => {
    expect(comprobarEntradaYSalida(servicio, { fecha: '2026-10-02' }, { fecha: '2026-10-05' }, HOY)).toBeNull();
  });

  it('no debería mirar las noches de en medio: el perro ya está dentro', () => {
    // Entra el viernes, pasa el fin de semana y sale el lunes.
    expect(comprobarEntradaYSalida(servicio, { fecha: '2026-10-02' }, { fecha: '2026-10-05' }, HOY)).toBeNull();
  });

  it('debería rechazar una entrada en día cerrado y ofrecer los días abiertos más cercanos', () => {
    const problema = comprobarEntradaYSalida(servicio, { fecha: '2026-10-03' }, { fecha: '2026-10-08' }, HOY);
    expect(problema?.momento).toBe('entrada');
    expect(problema?.motivo).toContain('sábado 3 de octubre');
    // Viernes (a 1 día) antes que lunes (a 2 días).
    expect(problema?.alternativas).toEqual(['2026-10-02', '2026-10-05']);
  });

  it('debería rechazar una salida en día cerrado sin proponer días anteriores a la entrada', () => {
    const problema = comprobarEntradaYSalida(servicio, { fecha: '2026-10-02' }, { fecha: '2026-10-04' }, HOY);
    expect(problema?.momento).toBe('salida');
    expect(problema?.alternativas).toEqual(['2026-10-05']);
  });

  it('debería respetar los cierres puntuales por encima de la semana', () => {
    const problema = comprobarEntradaYSalida(servicio, { fecha: '2026-10-09' }, { fecha: '2026-10-12' }, HOY);
    expect(problema?.momento).toBe('salida');
    expect(problema?.alternativas[0]).toBe('2026-10-13');
  });

  it('debería rechazar una hora fuera del horario y proponer el mismo día con otra hora', () => {
    const problema = comprobarEntradaYSalida(
      servicio, { fecha: '2026-10-02', hora: '18:00' }, { fecha: '2026-10-05', hora: '10:00' }, HOY,
    );
    expect(problema?.momento).toBe('entrada');
    expect(problema?.motivo).toContain('09:00–14:00');
    expect(problema?.alternativas[0]).toBe('2026-10-02');
    expect(comprobarEntradaYSalida(
      servicio, { fecha: '2026-10-02', hora: '09:00' }, { fecha: '2026-10-05', hora: '13:30' }, HOY,
    )).toBeNull();
  });

  it('no debería proponer días pasados', () => {
    const problema = comprobarEntradaYSalida(servicio, { fecha: '2026-10-03' }, { fecha: '2026-10-08' }, '2026-10-03');
    expect(problema?.alternativas).toEqual(['2026-10-05']);
  });

  it('no debería bloquear nada a un comercio sin horario configurado', () => {
    expect(comprobarEntradaYSalida({ horario: [] }, { fecha: '2026-10-04', hora: '03:00' }, null, HOY)).toBeNull();
    expect(horasDeAtencion({}, '2026-10-04')).toBeNull();
  });

  it('debería listar las horas de atención del día y ninguna si cierra', () => {
    const horas = horasDeAtencion(servicio, '2026-10-02', 60);
    expect(horas).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00']);
    expect(horasDeAtencion(servicio, '2026-10-03')).toEqual([]);
    expect(diaCerrado(servicio, '2026-10-03')).toBe(true);
    expect(diaCerrado(servicio, '2026-10-02')).toBe(false);
  });

  it('debería describir el problema con las alternativas en una frase', () => {
    const problema = comprobarEntradaYSalida(servicio, { fecha: '2026-10-03' }, { fecha: '2026-10-08' }, HOY)!;
    expect(describirProblemaEstancia(problema)).toContain('el viernes 2 de octubre o el lunes 5 de octubre');
    expect(diaEnPalabras('2026-10-05')).toBe('el lunes 5 de octubre');
    expect(diasAbiertosCercanos(servicio, '2026-10-04', { hasta: '2026-10-04' })).toEqual(['2026-10-02']);
  });
});
