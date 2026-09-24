import { TestBed } from '@angular/core/testing';
import {
  EspecieMascota, FranjaTransporte, ModalidadTransporte, ModoHorarioTransporte, NecesidadTransporte,
  PatronRecurrenciaTransporte, SolicitudTransporte, TamanoPerro, TipoServicioTransporte, VueltaTransporte,
  hoyEnZona,
} from 'shared';
import { EleccionTransporte, TransporteViajeStore, borradorInicial, puntoValido } from './transporte-viaje.store';

const CLAVE = 'doogking_viaje_transporte';
const ORIGEN = { texto: 'Madrid', placeId: 'p-mad' };
const DESTINO = { texto: 'Toledo', lat: 39.86, lng: -4.02 };

const ELECCION: EleccionTransporte = {
  servicioId: 's1', comercioId: 'c1', titulo: 'Mascotas Express', modalidad: ModalidadTransporte.EXCLUSIVO, total: 80,
};

describe('TransporteViajeStore', () => {
  let store: TransporteViajeStore;

  const crear = (): TransporteViajeStore => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    store = TestBed.inject(TransporteViajeStore);
    return store;
  };

  const rutaLista = (): void => store.actualizar({ origen: ORIGEN, destino: DESTINO, fecha: '2026-10-01' });

  beforeEach(() => {
    sessionStorage.clear();
    crear();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('puntoValido', () => {
    it('debería aceptar un punto con placeId o con coordenadas y rechazar el resto', () => {
      expect(puntoValido({ texto: 'a', placeId: 'x' })).toBe(true);
      expect(puntoValido({ texto: 'a', lat: 1, lng: 2 })).toBe(true);
      expect(puntoValido({ texto: 'a', lat: 1 })).toBe(false);
      expect(puntoValido({ texto: 'a' })).toBe(false);
      expect(puntoValido(null)).toBe(false);
      expect(puntoValido(undefined)).toBe(false);
    });
  });

  describe('persistencia en sessionStorage', () => {
    it('debería guardar el borrador con su versión a cada cambio', () => {
      store.actualizar({ comportamiento: 'tranquilo' });
      TestBed.tick();

      const guardado = JSON.parse(sessionStorage.getItem(CLAVE) ?? '{}');
      expect(guardado.version).toBe(1);
      expect(guardado.borrador.comportamiento).toBe('tranquilo');
    });

    it('debería recuperar el borrador guardado al volver a crear el store', () => {
      store.actualizar({ origen: ORIGEN });
      TestBed.tick();

      crear();

      expect(store.borrador().origen).toEqual(ORIGEN);
      expect(store.borrador().hora).toBe('10:00');
    });

    it('debería descartar un borrador de otra versión', () => {
      sessionStorage.setItem(CLAVE, JSON.stringify({ version: 99, borrador: { comportamiento: 'viejo' } }));
      crear();
      expect(store.borrador()).toEqual(borradorInicial());
    });

    it('debería empezar vacío si el guardado está corrupto', () => {
      sessionStorage.setItem(CLAVE, '{no es json');
      crear();
      expect(store.borrador()).toEqual(borradorInicial());
    });

    it('no debería romper si el almacenamiento no deja escribir', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('lleno');
      });
      store.actualizar({ comportamiento: 'x' });
      expect(() => TestBed.tick()).not.toThrow();
      expect(store.borrador().comportamiento).toBe('x');
    });
  });

  describe('elegirTipo', () => {
    it('debería poner hoy y «lo antes posible» en un urgente', () => {
      store.elegirTipo(TipoServicioTransporte.URGENTE);
      expect(store.borrador().modoHorario).toBe(ModoHorarioTransporte.LO_ANTES_POSIBLE);
      expect(store.borrador().fecha).toBe(hoyEnZona());
    });

    it('debería pasar a «con propietario» al viajar con la mascota y volver a compartido al cambiar', () => {
      store.elegirTipo(TipoServicioTransporte.VIAJO_CON_MASCOTA);
      expect(store.borrador().modalidad).toBe(ModalidadTransporte.CON_PROPIETARIO);

      store.elegirTipo(TipoServicioTransporte.SOLO_IDA);
      expect(store.borrador().modalidad).toBe(ModalidadTransporte.COMPARTIDO);
    });

    it('no debería pisar una modalidad elegida a mano que no sea con propietario', () => {
      store.actualizar({ modalidad: ModalidadTransporte.EXCLUSIVO });
      store.elegirTipo(TipoServicioTransporte.IDA_VUELTA);
      expect(store.borrador().modalidad).toBe(ModalidadTransporte.EXCLUSIVO);
      expect(store.borrador().tipoServicio).toBe(TipoServicioTransporte.IDA_VUELTA);
    });
  });

  describe('rutaCompleta y solicitud', () => {
    it('debería ser null mientras falte la ruta o la fecha', () => {
      expect(store.rutaCompleta()).toBe(false);
      expect(store.solicitud()).toBeNull();
      store.actualizar({ origen: ORIGEN, destino: { texto: 'sin situar' }, fecha: '2026-10-01' });
      expect(store.rutaCompleta()).toBe(false);
    });

    it('debería construir una solicitud de solo ida con hora concreta y mascotas manuales', () => {
      rutaLista();
      store.actualizar({ numeroManual: 2, especieManual: EspecieMascota.GATO, tamanoManual: TamanoPerro.PEQUENO });

      const s = store.solicitud();
      expect(store.rutaCompleta()).toBe(true);
      expect(s?.hora).toBe('10:00');
      expect(s?.franja).toBeUndefined();
      expect(s?.vuelta).toBeUndefined();
      expect(s?.recurrencia).toBeUndefined();
      expect(s?.mascotas).toEqual([
        { especie: EspecieMascota.GATO, tamano: TamanoPerro.PEQUENO },
        { especie: EspecieMascota.GATO, tamano: TamanoPerro.PEQUENO },
      ]);
      expect(s?.personas).toBeUndefined();
    });

    it('debería exigir hora en el modo hora concreta', () => {
      rutaLista();
      store.actualizar({ hora: '' });
      expect(store.rutaCompleta()).toBe(false);
    });

    it('debería mandar la franja si el cliente es flexible', () => {
      rutaLista();
      store.actualizar({ modoHorario: ModoHorarioTransporte.FLEXIBLE, franja: FranjaTransporte.TARDE });
      expect(store.solicitud()?.franja).toBe(FranjaTransporte.TARDE);
      expect(store.solicitud()?.hora).toBeUndefined();
    });

    it('debería usar las mascotas elegidas sin sus datos de presentación', () => {
      rutaLista();
      store.actualizar({
        mascotas: [{ perroId: 'p1', nombre: 'Hachi', especie: 'perro', tamano: TamanoPerro.GRANDE, foto: 'f.jpg', raza: 'Akita' }],
      });
      expect(store.mascotasDelViaje()).toEqual([
        { perroId: 'p1', nombre: 'Hachi', especie: 'perro', tamano: TamanoPerro.GRANDE },
      ]);
    });

    it.each([
      [VueltaTransporte.HORA, { modo: VueltaTransporte.HORA, hora: '18:00' }],
      [VueltaTransporte.TRAS_HORAS, { modo: VueltaTransporte.TRAS_HORAS, horas: 2 }],
      [VueltaTransporte.CUANDO_AVISE, { modo: VueltaTransporte.CUANDO_AVISE }],
    ])('debería construir la vuelta en modo %s', (modo, esperado) => {
      rutaLista();
      store.actualizar({ tipoServicio: TipoServicioTransporte.IDA_VUELTA, vueltaModo: modo });
      expect(store.solicitud()?.vuelta).toEqual(esperado);
    });

    it('debería exigir el día de vuelta cuando vuelve otro día', () => {
      rutaLista();
      store.actualizar({ tipoServicio: TipoServicioTransporte.IDA_VUELTA, vueltaModo: VueltaTransporte.OTRO_DIA });
      expect(store.rutaCompleta()).toBe(false);

      store.actualizar({ vueltaFecha: '2026-10-03' });
      expect(store.solicitud()?.vuelta).toEqual({ modo: VueltaTransporte.OTRO_DIA, fecha: '2026-10-03', hora: '18:00' });
    });

    it('debería construir la recurrencia con los días del patrón y exigir el fin', () => {
      rutaLista();
      store.actualizar({ tipoServicio: TipoServicioTransporte.RECURRENTE });
      expect(store.rutaCompleta()).toBe(false);

      store.actualizar({ hasta: '2026-11-01' });
      expect(store.solicitud()?.recurrencia).toEqual({
        patron: PatronRecurrenciaTransporte.LABORABLES, diasSemana: [1, 2, 3, 4, 5], hora: '10:00', hasta: '2026-11-01',
      });
    });

    it('debería usar las 09:00 en una recurrencia sin hora concreta', () => {
      rutaLista();
      store.actualizar({
        tipoServicio: TipoServicioTransporte.RECURRENTE, hasta: '2026-11-01', modoHorario: ModoHorarioTransporte.FLEXIBLE,
        patron: PatronRecurrenciaTransporte.PERSONALIZADO, diasSemana: [3, 1, 3],
      });
      expect(store.solicitud()?.recurrencia).toEqual(expect.objectContaining({ hora: '09:00', diasSemana: [1, 3] }));
    });

    it('debería mandar personas y equipaje sólo con propietario y la otra necesidad sólo si se marcó', () => {
      rutaLista();
      store.actualizar({
        modalidad: ModalidadTransporte.CON_PROPIETARIO, personas: 2,
        necesidades: [NecesidadTransporte.OTRA], necesidadOtra: 'Rampa', comportamiento: 'tranquilo', notaTransportista: 'Llamar',
      });
      const s = store.solicitud();
      expect(s?.personas).toBe(2);
      expect(s?.equipaje).toBeDefined();
      expect(s?.necesidadOtra).toBe('Rampa');
      expect(s?.comportamiento).toBe('tranquilo');
      expect(s?.notaTransportista).toBe('Llamar');

      store.actualizar({ necesidades: [NecesidadTransporte.JAULA] });
      expect(store.solicitud()?.necesidadOtra).toBeUndefined();
    });
  });

  it('debería intercambiar origen y destino', () => {
    rutaLista();
    store.intercambiarPuntos();
    expect(store.borrador().origen).toEqual(DESTINO);
    expect(store.borrador().destino).toEqual(ORIGEN);
  });

  it('debería guardar la elección con su modalidad y olvidar el presupuesto', () => {
    store.actualizar({ presupuestoId: 'pr1' });
    store.elegir(ELECCION);
    expect(store.borrador().eleccion).toEqual(ELECCION);
    expect(store.borrador().modalidad).toBe(ModalidadTransporte.EXCLUSIVO);
    expect(store.borrador().presupuestoId).toBeNull();
  });

  describe('cargarSolicitud', () => {
    it('debería rehacer el borrador desde una solicitud completa', () => {
      const solicitud: SolicitudTransporte = {
        tipoServicio: TipoServicioTransporte.IDA_VUELTA, origen: ORIGEN, destino: DESTINO, fecha: '2026-10-01',
        modoHorario: ModoHorarioTransporte.HORA_CONCRETA, hora: '08:00',
        vuelta: { modo: VueltaTransporte.OTRO_DIA, fecha: '2026-10-02', hora: '19:00' },
        mascotas: [{ especie: 'perro', tamano: TamanoPerro.MINI }, { especie: 'gato', tamano: TamanoPerro.MINI }],
        necesidades: [NecesidadTransporte.OTRA], necesidadOtra: 'x', comportamiento: 'tranquilo', notaTransportista: 'n',
        modalidad: ModalidadTransporte.CON_PROPIETARIO, personas: 3, preferencias: [],
      };

      store.cargarSolicitud(solicitud, 'pr1', ELECCION);

      const b = store.borrador();
      expect(b.hora).toBe('08:00');
      expect(b.vueltaModo).toBe(VueltaTransporte.OTRO_DIA);
      expect(b.vueltaFecha).toBe('2026-10-02');
      expect(b.numeroManual).toBe(2);
      expect(b.personas).toBe(3);
      expect(b.presupuestoId).toBe('pr1');
      expect(b.eleccion).toEqual(ELECCION);
      expect(store.solicitud()?.vuelta).toEqual(solicitud.vuelta);
    });

    it('debería rellenar con los valores por defecto lo que la solicitud no trae', () => {
      store.cargarSolicitud({
        tipoServicio: TipoServicioTransporte.RECURRENTE, origen: ORIGEN, destino: DESTINO, fecha: '2026-10-01',
        modoHorario: ModoHorarioTransporte.LO_ANTES_POSIBLE,
        recurrencia: { patron: PatronRecurrenciaTransporte.SEMANAL, diasSemana: [2], hora: '09:00', hasta: '2026-12-01' },
        mascotas: [{ especie: 'perro', tamano: TamanoPerro.MINI }], necesidades: [],
        modalidad: ModalidadTransporte.COMPARTIDO, preferencias: [],
      }, 'pr2', ELECCION);

      const b = store.borrador();
      const base = borradorInicial();
      expect(b.hora).toBe(base.hora);
      expect(b.franja).toBe(base.franja);
      expect(b.patron).toBe(PatronRecurrenciaTransporte.SEMANAL);
      expect(b.diasSemana).toEqual([2]);
      expect(b.hasta).toBe('2026-12-01');
      expect(b.personas).toBe(1);
      expect(b.necesidadOtra).toBe('');
      expect(b.equipaje).toBe(base.equipaje);
    });
  });

  it('debería volver al borrador vacío al reiniciar', () => {
    rutaLista();
    store.reiniciar();
    expect(store.borrador()).toEqual(borradorInicial());
  });
});
