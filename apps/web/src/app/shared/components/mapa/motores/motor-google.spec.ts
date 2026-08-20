/// <reference types="google.maps" />

import { cargarGoogleMaps } from './google-maps.loader';
import { crearMotorGoogle } from './motor-google';
import type { EscuchasMotor, OpcionesMotor, PuntoMapa } from './motor-mapa';

jest.mock('./google-maps.loader', () => ({ cargarGoogleMaps: jest.fn() }));

const cargar = cargarGoogleMaps as jest.MockedFunction<typeof cargarGoogleMaps>;

const PUNTOS: PuntoMapa[] = [
  { id: 'a1', lat: 40.4168, lng: -3.7038, etiqueta: '24 €', titulo: 'Residencia Las Rozas' },
  { id: 'a2', lat: 41.3874, lng: 2.1686, etiqueta: '30 €', titulo: 'Can Feliç' },
  { id: 'sin-geo', lat: NaN, lng: NaN, etiqueta: '€19', titulo: 'Sin geocodificar' },
];

/**
 * Doble del SDK: Google no se puede cargar en jsdom, así que se sustituye por
 * lo justo que usa el motor. Permite comprobar *qué* le pide el motor al mapa,
 * que es lo que de verdad puede romperse al cambiar de proveedor.
 */
function crearSdkFalso() {
  const escuchas = new Map<string, () => void>();
  const escuchasUnicas = new Map<string, () => void>();
  const panel = document.createElement('div');

  const mapa = {
    fitBounds: jest.fn(),
    setCenter: jest.fn(),
    setZoom: jest.fn(),
    getCenter: jest.fn(() => ({ lat: () => 40.4, lng: () => -3.7 })),
    getZoom: jest.fn(() => 12),
    getBounds: jest.fn(() => ({
      getSouthWest: () => ({ lat: () => 39, lng: () => -4 }),
      getNorthEast: () => ({ lat: () => 41, lng: () => -3 }),
    })),
    addListener: jest.fn((evento: string, cb: () => void) => { escuchas.set(evento, cb); }),
  };

  const tarjeta = {
    setContent: jest.fn(),
    setPosition: jest.fn(),
    open: jest.fn(),
    close: jest.fn(),
  };

  class OverlayViewFalsa {
    private mapaAsignado: unknown = null;

    setMap(valor: unknown): void {
      this.mapaAsignado = valor;
      if (valor) this.onAdd();
      else this.onRemove();
    }

    getMapaAsignado(): unknown {
      return this.mapaAsignado;
    }

    getPanes(): { overlayMouseTarget: HTMLElement } {
      return { overlayMouseTarget: panel };
    }

    getProjection(): { fromLatLngToDivPixel: () => { x: number; y: number } } {
      return { fromLatLngToDivPixel: () => ({ x: 10, y: 20 }) };
    }

    onAdd(): void { /* lo implementa la subclase */ }
    onRemove(): void { /* lo implementa la subclase */ }
  }

  const maps = {
    Map: jest.fn(() => mapa),
    InfoWindow: jest.fn(() => tarjeta),
    LatLng: jest.fn(),
    LatLngBounds: jest.fn(() => ({ extend: jest.fn() })),
    OverlayView: OverlayViewFalsa,
    event: {
      addListenerOnce: jest.fn((_mapa: unknown, evento: string, cb: () => void) => {
        escuchasUnicas.set(evento, cb);
      }),
    },
  } as unknown as typeof google.maps;

  return { maps, mapa, tarjeta, panel, escuchas, escuchasUnicas };
}

describe('crearMotorGoogle', () => {
  let sdk: ReturnType<typeof crearSdkFalso>;
  let escuchasMotor: jest.Mocked<EscuchasMotor>;
  let opciones: OpcionesMotor;

  beforeEach(() => {
    sdk = crearSdkFalso();
    cargar.mockResolvedValue(sdk.maps);
    escuchasMotor = { alMoverse: jest.fn(), alElegirPunto: jest.fn() };
    opciones = {
      lienzo: document.createElement('div'),
      centro: [40.4168, -3.7038],
      zoom: 11,
      zoomConRueda: true,
    };
  });

  it('debería montar el mapa en el lienzo con la vista pedida', async () => {
    await crearMotorGoogle('clave', opciones, escuchasMotor);

    expect(sdk.maps.Map).toHaveBeenCalledWith(opciones.lienzo, expect.objectContaining({
      center: { lat: 40.4168, lng: -3.7038 },
      zoom: 11,
    }));
  });

  it('debería dejar rodar la página cuando el mapa no es el de pantalla completa', async () => {
    await crearMotorGoogle('clave', { ...opciones, zoomConRueda: false }, escuchasMotor);

    const [, config] = (sdk.maps.Map as unknown as jest.Mock).mock.calls[0];
    expect(config.gestureHandling).toBe('cooperative');
    expect(config.zoomControl).toBe(false);
  });

  it('debería capturar el gesto solo en el mapa a pantalla completa', async () => {
    await crearMotorGoogle('clave', opciones, escuchasMotor);

    const [, config] = (sdk.maps.Map as unknown as jest.Mock).mock.calls[0];
    expect(config.gestureHandling).toBe('greedy');
  });

  it('no debería anunciar movimiento por el primer encuadre del propio mapa', async () => {
    await crearMotorGoogle('clave', opciones, escuchasMotor);

    expect(sdk.mapa.addListener).not.toHaveBeenCalled();
    expect(escuchasMotor.alMoverse).not.toHaveBeenCalled();

    // Solo tras ese primer asentamiento se empieza a escuchar de verdad.
    sdk.escuchasUnicas.get('idle')?.();
    sdk.escuchas.get('idle')?.();

    expect(escuchasMotor.alMoverse).toHaveBeenCalledTimes(1);
  });

  it('debería pintar un pin por cada servicio con coordenadas', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    motor.pintar(PUNTOS, 'a2');

    const pines = sdk.panel.querySelectorAll('.rs-pin');
    expect(pines).toHaveLength(2);
    expect(sdk.panel.querySelectorAll('.rs-pin--activo')).toHaveLength(1);
  });

  it('debería avisar del servicio elegido y abrir su tarjeta al pulsar el pin', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    motor.pintar(PUNTOS, null);

    sdk.panel.querySelector<HTMLElement>('.rs-pin')?.click();

    expect(escuchasMotor.alElegirPunto).toHaveBeenCalledWith('a1');
    expect(sdk.tarjeta.setContent).toHaveBeenCalledWith(expect.stringContaining('Residencia Las Rozas'));
    expect(sdk.tarjeta.open).toHaveBeenCalled();
  });

  it('debería retirar los pines anteriores antes de repintar', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    motor.pintar(PUNTOS, null);
    motor.pintar([PUNTOS[0]], null);

    expect(sdk.panel.querySelectorAll('.rs-pin')).toHaveLength(1);
  });

  it('debería traducir la vista a la zona que espera el API', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);

    expect(motor.zonaActual()).toEqual({
      swLat: 39, swLng: -4, neLat: 41, neLng: -3,
      centroLat: 40.4, centroLng: -3.7, zoom: 12,
    });
  });

  it('debería devolver null mientras el mapa no sepa qué rectángulo enseña', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    sdk.mapa.getBounds.mockReturnValue(undefined as never);

    expect(motor.zonaActual()).toBeNull();
  });

  it('debería encajar la vista a los puntos al encuadrar', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    motor.encuadrar(PUNTOS.slice(0, 2));

    expect(sdk.mapa.fitBounds).toHaveBeenCalled();
  });

  it('debería llevar el mapa a la población elegida en el buscador', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    motor.centrarEn(41.3874, 2.1686, 13);

    expect(sdk.mapa.setCenter).toHaveBeenCalledWith({ lat: 41.3874, lng: 2.1686 });
    expect(sdk.mapa.setZoom).toHaveBeenCalledWith(13);
  });

  it('debería reponer el centro al refrescar tras un cambio de tamaño', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    motor.refrescar();

    expect(sdk.mapa.setCenter).toHaveBeenCalled();
  });

  it('debería cerrar la tarjeta y limpiar los pines al destruirse', async () => {
    const motor = await crearMotorGoogle('clave', opciones, escuchasMotor);
    motor.pintar(PUNTOS, null);
    motor.destruir();

    expect(sdk.tarjeta.close).toHaveBeenCalled();
    expect(sdk.panel.querySelectorAll('.rs-pin')).toHaveLength(0);
  });
});
