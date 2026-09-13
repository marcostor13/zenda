import {
  claveDiaEnZona, comprobarHorario, desfaseIso, desfaseMinutos, esMedianocheUtc, fechaYHoraEnZona,
  horaEnZona, instanteEnZona, parsearFechaPlataforma, partesEnZona,
} from './zona-horaria';
import { horarioSemanal } from '../dtos/comunes/horario.dto';

describe('zona horaria de la plataforma', () => {
  describe('desfase y partes', () => {
    it('debería saber que Madrid va dos horas por delante en verano y una en invierno', () => {
      expect(desfaseMinutos(new Date('2026-07-01T12:00:00Z'))).toBe(120);
      expect(desfaseMinutos(new Date('2026-01-15T12:00:00Z'))).toBe(60);
      expect(desfaseIso(new Date('2026-07-01T12:00:00Z'))).toBe('+0200');
      expect(desfaseIso(new Date('2026-07-01T12:00:00Z'), 'America/Lima')).toBe('-0500');
    });

    it('debería dar el día y la hora de Madrid aunque en UTC sea otro día', () => {
      const p = partesEnZona(new Date('2026-09-19T22:30:00Z'));
      expect(p).toMatchObject({ anio: 2026, mes: 9, dia: 20, hora: 0, minuto: 30, diaSemana: 0 });
      expect(claveDiaEnZona('2026-09-19T22:30:00Z')).toBe('2026-09-20');
      expect(horaEnZona('2026-09-19T22:30:00Z')).toBe('00:30');
    });
  });

  describe('de hora de pared a instante', () => {
    it('debería convertir las 10:00 de Madrid al instante UTC correcto en verano e invierno', () => {
      expect(fechaYHoraEnZona('2026-09-20', '10:00').toISOString()).toBe('2026-09-20T08:00:00.000Z');
      expect(fechaYHoraEnZona('2026-12-20', '10:00').toISOString()).toBe('2026-12-20T09:00:00.000Z');
    });

    it('debería acertar el día del cambio de hora', () => {
      // 29 mar 2026: a las 02:00 pasan a ser las 03:00.
      expect(instanteEnZona({ anio: 2026, mes: 3, dia: 29, hora: 4 }).toISOString()).toBe('2026-03-29T02:00:00.000Z');
      expect(instanteEnZona({ anio: 2026, mes: 3, dia: 29, hora: 1 }).toISOString()).toBe('2026-03-29T00:00:00.000Z');
      // 25 oct 2026: a las 03:00 vuelven a ser las 02:00.
      expect(instanteEnZona({ anio: 2026, mes: 10, dia: 25, hora: 12 }).toISOString()).toBe('2026-10-25T11:00:00.000Z');
    });
  });

  describe('parsearFechaPlataforma', () => {
    it('debería dejar un día sin hora a medianoche UTC', () => {
      const fecha = parsearFechaPlataforma('2026-09-20');
      expect(fecha.toISOString()).toBe('2026-09-20T00:00:00.000Z');
      expect(esMedianocheUtc(fecha)).toBe(true);
    });

    it('debería leer una hora sin zona como hora de Madrid, no del servidor', () => {
      expect(parsearFechaPlataforma('2026-09-20T10:00:00').toISOString()).toBe('2026-09-20T08:00:00.000Z');
      expect(parsearFechaPlataforma('2026-09-20T10:00').toISOString()).toBe('2026-09-20T08:00:00.000Z');
    });

    it('debería respetar el instante si trae zona', () => {
      expect(parsearFechaPlataforma('2026-09-20T10:00:00Z').toISOString()).toBe('2026-09-20T10:00:00.000Z');
      expect(parsearFechaPlataforma('2026-09-20T10:00:00+02:00').toISOString()).toBe('2026-09-20T08:00:00.000Z');
    });
  });

  describe('comprobarHorario', () => {
    const horario = horarioSemanal(
      { dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], abre: '09:00', cierra: '14:00', abre2: '16:00', cierra2: '20:00' },
      { dias: ['sabado'], abre: '10:00', cierra: '13:00' },
    );
    // Lunes 21 de septiembre de 2026.
    const cita = (hora: string, minutos = 30, dia = '2026-09-21') => {
      const inicio = fechaYHoraEnZona(dia, hora);
      return [inicio, new Date(inicio.getTime() + minutos * 60000)] as const;
    };

    it('debería aceptar una cita dentro de cualquiera de los dos tramos', () => {
      expect(comprobarHorario(horario, [], ...cita('09:00')).permitido).toBe(true);
      expect(comprobarHorario(horario, [], ...cita('19:30')).permitido).toBe(true);
    });

    it('debería rechazar la cita que empieza o termina fuera del horario', () => {
      expect(comprobarHorario(horario, [], ...cita('08:30')).permitido).toBe(false);
      const pasaDelCierre = comprobarHorario(horario, [], ...cita('13:45'));
      expect(pasaDelCierre).toMatchObject({ permitido: false });
      expect(pasaDelCierre.motivo).toContain('09:00–14:00 y 16:00–20:00');
    });

    it('debería rechazar un día cerrado, en la hora de Madrid', () => {
      // Domingo 20 a las 23:30 UTC ya es lunes en Madrid... pero el 20 a las 12:00 es domingo.
      expect(comprobarHorario(horario, [], ...cita('12:00', 30, '2026-09-20')))
        .toEqual({ permitido: false, motivo: 'El comercio no atiende ese día de la semana.' });
    });

    it('debería aplicar los días especiales por encima de la semana', () => {
      const excepciones = [
        { fecha: '2026-09-21', cerrado: true, motivo: 'Festivo' },
        { fecha: '2026-09-26', cerrado: false, abre: '17:00', cierra: '19:00' },
      ];
      expect(comprobarHorario(horario, excepciones, ...cita('10:00')))
        .toEqual({ permitido: false, motivo: 'El comercio cierra ese día (Festivo).' });
      expect(comprobarHorario(horario, excepciones, ...cita('17:30', 30, '2026-09-26')).permitido).toBe(true);
      expect(comprobarHorario(horario, excepciones, ...cita('11:00', 30, '2026-09-26')).permitido).toBe(false);
    });

    it('no debería bloquear si el comercio no ha configurado horario o el día no tiene horas', () => {
      expect(comprobarHorario(undefined, undefined, ...cita('03:00')).permitido).toBe(true);
      expect(comprobarHorario([{ dia: 'lunes', cerrado: false }], [], ...cita('03:00')).permitido).toBe(true);
    });
  });
});
