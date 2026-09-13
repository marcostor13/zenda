import { calcularHuecos, pasoDeHuecos, plazasOcupadas, type CalculoHuecos } from './huecos.util';

// Lunes 21 de septiembre de 2026, horario de verano en Madrid (UTC+2).
const clave = '2026-09-21';
const madrid = (hora: string) => new Date(`${clave}T${hora}:00+02:00`);

const base: CalculoHuecos = {
  clave,
  dia: { estado: 'abierto', tramos: [[9 * 60, 11 * 60], [16 * 60, 17 * 60]] },
  duracionMin: 30,
  capacidad: 1,
  ocupaciones: [],
  ahora: new Date('2026-09-01T00:00:00Z'),
};

const horas = (c: CalculoHuecos) => calcularHuecos(c).huecos.map((h) => h.hora);
const libres = (c: CalculoHuecos) => calcularHuecos(c).huecos.filter((h) => h.disponible).map((h) => h.hora);

describe('huecos de cita', () => {
  it('debería ofrecer citas cada media hora dentro de cada tramo, sin pasarse del cierre', () => {
    expect(horas(base)).toEqual(['09:00', '09:30', '10:00', '10:30', '16:00', '16:30']);
    expect(horas({ ...base, duracionMin: 45 })).toEqual(['09:00', '09:30', '10:00', '16:00']);
  });

  it('debería dar el inicio como instante de Madrid', () => {
    expect(calcularHuecos(base).huecos[0].inicio).toBe('2026-09-21T07:00:00.000Z');
  });

  it('debería ofrecer cada cuarto de hora las citas cortas', () => {
    expect(pasoDeHuecos(15)).toBe(15);
    expect(pasoDeHuecos(30)).toBe(30);
    expect(horas({ ...base, duracionMin: 20, dia: { estado: 'abierto', tramos: [[540, 600]] } }))
      .toEqual(['09:00', '09:15', '09:30']);
  });

  it('debería marcar ocupadas las horas que pisa una cita ya reservada', () => {
    const ocupaciones = [{ inicio: madrid('09:30'), fin: madrid('10:15'), plazas: 1 }];

    expect(libres({ ...base, ocupaciones })).toEqual(['09:00', '10:30', '16:00', '16:30']);
  });

  it('debería dejar reservar mientras queden mesas libres', () => {
    const ocupaciones = [
      { inicio: madrid('09:00'), fin: madrid('10:00'), plazas: 1 },
      { inicio: madrid('09:30'), fin: madrid('10:00'), plazas: 1 },
    ];

    expect(libres({ ...base, capacidad: 2, ocupaciones })).toEqual(['09:00', '10:00', '10:30', '16:00', '16:30']);
  });

  it('debería tapar todo lo que cubre un cierre total', () => {
    const ocupaciones = [{ inicio: madrid('16:00'), fin: madrid('20:00'), plazas: Number.MAX_SAFE_INTEGER }];

    expect(libres({ ...base, capacidad: 3, ocupaciones })).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('no debería ofrecer horas que ya han pasado', () => {
    expect(libres({ ...base, ahora: madrid('10:00') })).toEqual(['10:30', '16:00', '16:30']);
  });

  it('debería usar 9:00–20:00 si el comercio no tiene horario, y nada si cierra', () => {
    const sinHorario = calcularHuecos({ ...base, dia: { estado: 'sin_horario' }, duracionMin: 60 });
    expect(sinHorario.estado).toBe('sin_horario');
    expect(sinHorario.huecos).toHaveLength(21);

    expect(calcularHuecos({ ...base, dia: { estado: 'cerrado', motivo: 'Festivo' } }))
      .toEqual({ estado: 'cerrado', motivo: 'Festivo', huecos: [] });
  });

  it('debería contar el pico de plazas a la vez, no la suma de lo que solapa', () => {
    const ocupaciones = [
      { inicio: madrid('09:00'), fin: madrid('09:30'), plazas: 1 },
      { inicio: madrid('09:30'), fin: madrid('10:00'), plazas: 1 },
      { inicio: madrid('12:00'), fin: madrid('13:00'), plazas: 1 },
    ];

    expect(plazasOcupadas(ocupaciones, madrid('09:00'), madrid('10:00'))).toBe(1);
    expect(plazasOcupadas(ocupaciones, madrid('10:00'), madrid('11:00'))).toBe(0);
    // Una ocupación que empezó antes cuenta desde el principio de la cita.
    expect(plazasOcupadas(ocupaciones, madrid('09:15'), madrid('09:45'))).toBe(1);
  });
});
