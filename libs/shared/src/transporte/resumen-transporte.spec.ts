import { TamanoPerro } from '../enums/perro.enum';
import { SolicitudTransporte } from './cotizar-transporte';
import { resumenSolicitudTransporte } from './resumen-transporte';
import {
  ComportamientoViaje, EquipajeTransporte, FranjaTransporte, ModalidadTransporte, ModoHorarioTransporte,
  NecesidadTransporte, PatronRecurrenciaTransporte, PreferenciaTransporte, TipoServicioTransporte, VueltaTransporte,
} from './transporte.catalogo';

const solicitud = (extra: Partial<SolicitudTransporte> = {}): SolicitudTransporte => ({
  tipoServicio: TipoServicioTransporte.SOLO_IDA,
  origen: { texto: 'Castellón' },
  destino: { texto: 'Valencia' },
  fecha: '2026-10-01',
  modoHorario: ModoHorarioTransporte.HORA_CONCRETA,
  hora: '10:30',
  mascotas: [{ nombre: 'Toby', especie: 'Perro', tamano: TamanoPerro.MEDIANO }],
  necesidades: [],
  modalidad: ModalidadTransporte.COMPARTIDO,
  preferencias: [],
  ...extra,
});

const valor = (filas: Array<[string, string]>, etiqueta: string): string | undefined =>
  filas.find(([e]) => e === etiqueta)?.[1];

describe('resumenSolicitudTransporte', () => {
  it('debería resumir una solicitud básica sin filas vacías', () => {
    const filas = resumenSolicitudTransporte(solicitud());

    expect(filas).toEqual([
      ['Servicio', 'Solo ida'],
      ['Recogida', 'Castellón'],
      ['Entrega', 'Valencia'],
      ['Fecha', '2026-10-01'],
      ['Hora', '10:30'],
      ['Mascotas', 'Toby (Perro, Mediano)'],
      ['Modalidad', 'Transporte compartido'],
    ]);
  });

  it('debería describir una mascota sin nombre por especie y tamaño', () => {
    const filas = resumenSolicitudTransporte(solicitud({
      mascotas: [{ especie: 'gato', tamano: TamanoPerro.PEQUENO }, { especie: 'iguana', tamano: TamanoPerro.MINI }],
    }));
    expect(valor(filas, 'Mascotas')).toBe('Gato, Pequeño · Otro, Mini');
  });

  it('debería escribir el horario flexible con su franja o «Cualquier horario»', () => {
    const conFranja = resumenSolicitudTransporte(solicitud({ modoHorario: ModoHorarioTransporte.FLEXIBLE, franja: FranjaTransporte.TARDE }));
    const sinFranja = resumenSolicitudTransporte(solicitud({ modoHorario: ModoHorarioTransporte.FLEXIBLE }));
    expect(valor(conFranja, 'Hora')).toBe('Flexible · Tarde');
    expect(valor(sinFranja, 'Hora')).toBe('Flexible · Cualquier horario');
  });

  it('debería escribir «Lo antes posible»', () => {
    const filas = resumenSolicitudTransporte(solicitud({ modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE }));
    expect(valor(filas, 'Hora')).toBe('Lo antes posible');
  });

  it('debería omitir la fila de hora si la hora concreta no trae hora', () => {
    const filas = resumenSolicitudTransporte(solicitud({ hora: undefined }));
    expect(valor(filas, 'Hora')).toBeUndefined();
  });

  it.each([
    [{ modo: VueltaTransporte.HORA, hora: '18:00' }, 'A una hora determinada · 18:00'],
    [{ modo: VueltaTransporte.HORA }, 'A una hora determinada'],
    [{ modo: VueltaTransporte.TRAS_HORAS, horas: 3 }, 'Tras 3 h'],
    [{ modo: VueltaTransporte.CUANDO_AVISE }, 'Cuando yo avise'],
    [{ modo: VueltaTransporte.OTRO_DIA, fecha: '2026-10-03', hora: '12:00' }, '2026-10-03 12:00'],
  ])('debería describir la vuelta %o como «%s»', (vuelta, esperado) => {
    const filas = resumenSolicitudTransporte(solicitud({ tipoServicio: TipoServicioTransporte.IDA_VUELTA, vuelta }));
    expect(valor(filas, 'Vuelta')).toBe(esperado);
  });

  it('debería omitir la vuelta de otro día sin fecha ni hora', () => {
    const filas = resumenSolicitudTransporte(solicitud({ vuelta: { modo: VueltaTransporte.OTRO_DIA } }));
    expect(valor(filas, 'Vuelta')).toBeUndefined();
  });

  it('debería incluir recurrencia, acompañantes, equipaje, necesidades, comportamiento, preferencias y nota', () => {
    const filas = resumenSolicitudTransporte(solicitud({
      tipoServicio: TipoServicioTransporte.RECURRENTE,
      recurrencia: { patron: PatronRecurrenciaTransporte.LABORABLES, diasSemana: [], hora: '10:30', hasta: '2026-12-31' },
      modalidad: ModalidadTransporte.CON_PROPIETARIO,
      personas: 2,
      equipaje: EquipajeTransporte.MALETA,
      necesidades: [NecesidadTransporte.ARNES, NecesidadTransporte.OTRA],
      necesidadOtra: 'Rampa',
      comportamiento: ComportamientoViaje.MIEDO_COCHE,
      preferencias: [PreferenciaTransporte.CLIMATIZACION, PreferenciaTransporte.PUERTA_A_PUERTA],
      notaTransportista: 'Llamar al llegar',
    }));

    expect(valor(filas, 'Servicio')).toBe('Traslado recurrente');
    expect(valor(filas, 'Repetición')).toBe('Días laborables · hasta 2026-12-31');
    expect(valor(filas, 'Modalidad')).toBe('Viajo con mi mascota');
    expect(valor(filas, 'Acompañantes')).toBe('2');
    expect(valor(filas, 'Equipaje')).toBe('Maleta');
    expect(valor(filas, 'Necesidades')).toBe('Arnés, Otra, Rampa');
    expect(valor(filas, 'Comportamiento')).toBe('Tiene miedo al coche');
    expect(valor(filas, 'Preferencias')).toBe('Vehículo climatizado, Puerta a puerta');
    expect(valor(filas, 'Información para el transportista')).toBe('Llamar al llegar');
  });

  it('debería conservar el valor crudo de un comportamiento desconocido', () => {
    const filas = resumenSolicitudTransporte(solicitud({ comportamiento: 'muerde cables' }));
    expect(valor(filas, 'Comportamiento')).toBe('muerde cables');
  });

  it('debería tolerar solicitudes incompletas sin origen, destino ni mascotas', () => {
    const incompleta = { ...solicitud(), origen: undefined, destino: undefined, mascotas: undefined } as unknown as SolicitudTransporte;
    const filas = resumenSolicitudTransporte(incompleta);
    expect(valor(filas, 'Recogida')).toBeUndefined();
    expect(valor(filas, 'Mascotas')).toBeUndefined();
  });
});
