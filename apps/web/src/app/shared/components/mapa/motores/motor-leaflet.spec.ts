import { crearMotorLeaflet } from './motor-leaflet';
import type { EscuchasMotor, OpcionesMotor, PuntoMapa } from './motor-mapa';

/**
 * Leaflet necesita un contenedor con tamaño real, así que se sustituye por un
 * doble: lo que interesa comprobar es qué le pide el motor de respaldo, no que
 * la librería sepa pintar teselas.
 */
const marcadorFalso = () => {
  const marcador = {
    addTo: jest.fn(() => marcador),
    on: jest.fn(() => marcador),
    bindPopup: jest.fn(() => marcador),
    remove: jest.fn(),
  };
  return marcador;
};

const mapaFalso = {
  on: jest.fn(),
  setView: jest.fn(),
  fitBounds: jest.fn(),
  invalidateSize: jest.fn(),
  remove: jest.fn(),
  getZoom: jest.fn(() => 12),
  getCenter: jest.fn(() => ({ lat: 40.4, lng: -3.7 })),
  getBounds: jest.fn(() => ({
    getSouth: () => 39, getWest: () => -4, getNorth: () => 41, getEast: () => -3,
  })),
};

const marcadores: ReturnType<typeof marcadorFalso>[] = [];

const controlZoom = { addTo: jest.fn() };

jest.mock('leaflet', () => ({
  map: jest.fn(() => mapaFalso),
  control: { zoom: jest.fn(() => controlZoom) },
  tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
  divIcon: jest.fn((opciones: unknown) => opciones),
  latLngBounds: jest.fn((coords: unknown) => coords),
  marker: jest.fn(() => {
    const marcador = marcadorFalso();
    marcadores.push(marcador);
    return marcador;
  }),
}));

const PUNTOS: PuntoMapa[] = [
  { id: 'a1', lat: 40.4168, lng: -3.7038, etiqueta: '€24', titulo: 'Residencia Las Rozas' },
  { id: 'sin-geo', lat: NaN, lng: NaN, etiqueta: '€19', titulo: 'Sin geocodificar' },
];

describe('crearMotorLeaflet', () => {
  let escuchas: jest.Mocked<EscuchasMotor>;
  let opciones: OpcionesMotor;

  beforeEach(() => {
    jest.clearAllMocks();
    marcadores.length = 0;
    escuchas = { alMoverse: jest.fn(), alElegirPunto: jest.fn() };
    opciones = {
      lienzo: document.createElement('div'),
      centro: [40.4168, -3.7038],
      zoom: 11,
      zoomConRueda: false,
    };
  });

  it('debería montar el mapa con la vista pedida y sin secuestrar la rueda', async () => {
    const leaflet = await import('leaflet');
    await crearMotorLeaflet(opciones, escuchas);

    expect(leaflet.map).toHaveBeenCalledWith(opciones.lienzo, expect.objectContaining({
      center: [40.4168, -3.7038],
      zoom: 11,
      scrollWheelZoom: false,
    }));
  });

  it('no debería poner control de zoom en la miniatura, que es decorativa', async () => {
    const leaflet = await import('leaflet');
    await crearMotorLeaflet(opciones, escuchas);

    expect(leaflet.control.zoom).not.toHaveBeenCalled();
  });

  it('debería alejar el control de zoom de la caja "Buscar en el mapa"', async () => {
    const leaflet = await import('leaflet');
    await crearMotorLeaflet({ ...opciones, zoomConRueda: true }, escuchas);

    expect(leaflet.control.zoom).toHaveBeenCalledWith({ position: 'bottomright' });
  });

  it('debería pintar solo los servicios con coordenadas', async () => {
    const motor = await crearMotorLeaflet(opciones, escuchas);
    motor.pintar(PUNTOS, null);

    expect(marcadores).toHaveLength(1);
    expect(marcadores[0].bindPopup).toHaveBeenCalled();
  });

  it('debería centrar el pin sobre su coordenada y no anclarlo por la esquina', async () => {
    const leaflet = await import('leaflet');
    const motor = await crearMotorLeaflet(opciones, escuchas);
    motor.pintar(PUNTOS, null);

    expect(leaflet.divIcon).toHaveBeenCalledWith(expect.objectContaining({
      className: 'rs-pin-capa',
      iconSize: [0, 0],
    }));
  });

  it('debería retirar los marcadores anteriores antes de repintar', async () => {
    const motor = await crearMotorLeaflet(opciones, escuchas);
    motor.pintar(PUNTOS, null);
    motor.pintar(PUNTOS, null);

    expect(marcadores[0].remove).toHaveBeenCalled();
  });

  it('debería traducir la vista a la zona que espera el API', async () => {
    const motor = await crearMotorLeaflet(opciones, escuchas);

    expect(motor.zonaActual()).toEqual({
      swLat: 39, swLng: -4, neLat: 41, neLng: -3,
      centroLat: 40.4, centroLng: -3.7, zoom: 12,
    });
  });

  it('debería recalcular el tamaño al refrescar y soltar el mapa al destruirse', async () => {
    const motor = await crearMotorLeaflet(opciones, escuchas);
    motor.refrescar();
    motor.destruir();

    expect(mapaFalso.invalidateSize).toHaveBeenCalled();
    expect(mapaFalso.remove).toHaveBeenCalled();
  });
});
