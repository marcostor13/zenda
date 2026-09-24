import { TestBed } from '@angular/core/testing';
import { FranjaTransporte, ModoHorarioTransporte, TamanoPerro } from 'shared';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  detallesDelViaje, fechaCorta, horaLegible, lugarCorto, mascotasLegibles, textoDuracion,
} from './transporte-viaje.formato';
import { borradorInicial } from './transporte-viaje.store';

describe('transporte-viaje.formato', () => {
  let i18n: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    i18n = TestBed.inject(I18nService);
  });

  it('debería quedarse con la primera parte de una dirección', () => {
    expect(lugarCorto('Av. del Cid 120, 46014 Valencia, España')).toBe('Av. del Cid 120');
    expect(lugarCorto(null)).toBe('');
    expect(lugarCorto(undefined)).toBe('');
  });

  it('debería escribir la duración en horas y minutos', () => {
    expect(textoDuracion(65)).toBe('1 h 05 min');
    expect(textoDuracion(45)).toBe('45 min');
    expect(textoDuracion(120)).toBe('2 h 00 min');
  });

  it('debería girar la fecha sin pasar por zonas horarias', () => {
    expect(fechaCorta('2026-09-25')).toBe('25/09/2026');
    expect(fechaCorta('raro')).toBe('raro');
  });

  it('debería describir la hora según el modo elegido', () => {
    const base = { hora: '10:30', franja: FranjaTransporte.TARDE };
    expect(horaLegible({ ...base, modoHorario: ModoHorarioTransporte.HORA_CONCRETA }, i18n)).toBe('10:30');
    expect(horaLegible({ ...base, modoHorario: ModoHorarioTransporte.FLEXIBLE }, i18n)).toBe('Tarde');
    expect(horaLegible({ ...base, modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE }, i18n)).toBe('Lo antes posible');
  });

  it('debería nombrar las mascotas si todas tienen nombre', () => {
    expect(mascotasLegibles([
      { nombre: 'Hachi', especie: 'perro', tamano: TamanoPerro.GRANDE },
      { nombre: 'Luna', especie: 'gato', tamano: TamanoPerro.MINI },
    ], i18n)).toBe('Hachi, Luna');
  });

  it('debería contar especie y tamaño si falta algún nombre', () => {
    const texto = mascotasLegibles([
      { especie: 'Gato', tamano: TamanoPerro.MEDIANO },
      { nombre: 'Luna', especie: 'gato', tamano: TamanoPerro.MINI },
    ], i18n);
    expect(texto).toMatch(/^2 × Gato · /);
    expect(mascotasLegibles([], i18n)).toBe('');
  });

  it('debería juntar fecha, hora y mascotas sin huecos vacíos', () => {
    const b = { ...borradorInicial(), fecha: '2026-10-01' };
    expect(detallesDelViaje(b, [], i18n)).toEqual(['01/10/2026', '10:00']);
  });
});
