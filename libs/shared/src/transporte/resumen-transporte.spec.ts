import { TamanoPerro } from '../enums/perro.enum';
import { resumenSolicitudViaje } from './resumen-transporte';
import { SolicitudViaje } from './solicitud-viaje';
import { NecesidadTransporte } from './transporte.enums';
import {
  FranjaTransporte, ModalidadTransporte, ModoHorarioTransporte, NECESIDAD_OTRA, PatronRecurrenciaTransporte,
  VueltaTransporte,
} from './viaje.catalogo';

const solicitud = (extra: Partial<SolicitudViaje> = {}): SolicitudViaje => ({
  tipoServicio: NecesidadTransporte.SOLO_IDA,
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

describe('resumenSolicitudViaje', () => {
  it('debería resumir una solicitud básica sin filas vacías', () => {
    const filas = resumenSolicitudViaje(solicitud());

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
    const filas = resumenSolicitudViaje(solicitud({
      mascotas: [{ especie: 'gato', tamano: TamanoPerro.PEQUENO }, { especie: 'iguana', tamano: TamanoPerro.MINI }],
    }));
    expect(valor(filas, 'Mascotas')).toBe('Gato, Pequeño · Otro, Mini');
  });

  it('debería escribir el horario flexible con su franja o «Cualquier horario»', () => {
    const conFranja = resumenSolicitudViaje(solicitud({ modoHorario: ModoHorarioTransporte.FLEXIBLE, franja: FranjaTransporte.TARDE }));
    const sinFranja = resumenSolicitudViaje(solicitud({ modoHorario: ModoHorarioTransporte.FLEXIBLE }));
    expect(valor(conFranja, 'Hora')).toBe('Flexible · Tarde');
    expect(valor(sinFranja, 'Hora')).toBe('Flexible · Cualquier horario');
  });

  it('debería escribir «Lo antes posible»', () => {
    const filas = resumenSolicitudViaje(solicitud({ modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE }));
    expect(valor(filas, 'Hora')).toBe('Lo antes posible');
  });

  it('debería omitir la fila de hora si la hora concreta no trae hora', () => {
    const filas = resumenSolicitudViaje(solicitud({ hora: undefined }));
    expect(valor(filas, 'Hora')).toBeUndefined();
  });

  it.each([
    [{ modo: VueltaTransporte.HORA, hora: '18:00' }, 'A una hora determinada · 18:00'],
    [{ modo: VueltaTransporte.HORA }, 'A una hora determinada'],
    [{ modo: VueltaTransporte.TRAS_HORAS, horas: 3 }, 'Tras 3 h'],
    [{ modo: VueltaTransporte.CUANDO_AVISE }, 'Cuando yo avise'],
    [{ modo: VueltaTransporte.OTRO_DIA, fecha: '2026-10-03', hora: '12:00' }, '2026-10-03 12:00'],
  ])('debería describir la vuelta %o como «%s»', (vuelta, esperado) => {
    const filas = resumenSolicitudViaje(solicitud({ tipoServicio: NecesidadTransporte.IDA_VUELTA, vuelta }));
    expect(valor(filas, 'Vuelta')).toBe(esperado);
  });

  it('debería omitir la vuelta de otro día sin fecha ni hora', () => {
    const filas = resumenSolicitudViaje(solicitud({ vuelta: { modo: VueltaTransporte.OTRO_DIA } }));
    expect(valor(filas, 'Vuelta')).toBeUndefined();
  });

  it('debería incluir recurrencia, acompañantes, equipaje, necesidades, comportamiento, preferencias y nota', () => {
    const filas = resumenSolicitudViaje(solicitud({
      tipoServicio: NecesidadTransporte.RECURRENTE,
      recurrencia: { patron: PatronRecurrenciaTransporte.LABORABLES, diasSemana: [], hora: '10:30', hasta: '2026-12-31' },
      modalidad: ModalidadTransporte.CON_PROPIETARIO,
      personas: 2,
      equipaje: 'maleta',
      necesidades: ['arnes', NECESIDAD_OTRA],
      necesidadOtra: 'Rampa',
      comportamiento: 'miedo_coche',
      preferencias: ['climatizacion', 'aviso_entrega'],
      notaTransportista: 'Llamar al llegar',
    }));

    expect(valor(filas, 'Servicio')).toBe('Traslado recurrente');
    expect(valor(filas, 'Repetición')).toBe('Días laborables · hasta 2026-12-31');
    expect(valor(filas, 'Modalidad')).toBe('Viajo con mi mascota');
    expect(valor(filas, 'Acompañantes')).toBe('2');
    expect(valor(filas, 'Equipaje')).toBe('Maleta');
    expect(valor(filas, 'Necesidades')).toBe('Arnés, Rampa');
    expect(valor(filas, 'Comportamiento')).toBe('Miedo al coche');
    expect(valor(filas, 'Preferencias')).toBe('Climatización, Aviso de entrega');
    expect(valor(filas, 'Información para el transportista')).toBe('Llamar al llegar');
  });

  it('debería omitir la fila de necesidades si sólo marcó «otra» sin texto', () => {
    const filas = resumenSolicitudViaje(solicitud({ necesidades: [NECESIDAD_OTRA] }));
    expect(valor(filas, 'Necesidades')).toBeUndefined();
  });

  it('debería conservar el valor crudo de un servicio, modalidad o vuelta desconocidos', () => {
    const filas = resumenSolicitudViaje(solicitud({
      tipoServicio: 'teletransporte' as NecesidadTransporte,
      modalidad: 'en_globo' as ModalidadTransporte,
      vuelta: { modo: 'nunca' as VueltaTransporte },
    }));
    expect(valor(filas, 'Servicio')).toBe('teletransporte');
    expect(valor(filas, 'Modalidad')).toBe('en_globo');
    expect(valor(filas, 'Vuelta')).toBe('nunca');
  });

  it('debería conservar el valor crudo de un comportamiento desconocido', () => {
    const filas = resumenSolicitudViaje(solicitud({ comportamiento: 'muerde cables' }));
    expect(valor(filas, 'Comportamiento')).toBe('muerde cables');
  });

  it('debería tolerar solicitudes incompletas sin origen, destino ni mascotas', () => {
    const incompleta = { ...solicitud(), origen: undefined, destino: undefined, mascotas: undefined } as unknown as SolicitudViaje;
    const filas = resumenSolicitudViaje(incompleta);
    expect(valor(filas, 'Recogida')).toBeUndefined();
    expect(valor(filas, 'Mascotas')).toBeUndefined();
  });
});
