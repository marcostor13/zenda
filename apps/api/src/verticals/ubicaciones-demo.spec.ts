import { DESPLAZAMIENTO_DEMO, UBICACIONES_MADRID, ubicacionDemo, ubicacionServicio } from './ubicaciones-demo';

describe('ubicaciones-demo', () => {
  it('debería repartir un barrio distinto a cada listado', () => {
    const primero = ubicacionDemo(0);
    const segundo = ubicacionDemo(1);

    expect(primero.barrio).not.toBe(segundo.barrio);
  });

  it('debería volver a empezar cuando hay más listados que barrios', () => {
    const total = Object.keys(UBICACIONES_MADRID).length;

    // Repetir barrio es mejor que dejar un listado sin punto y fuera del mapa.
    expect(ubicacionDemo(total)).toEqual(ubicacionDemo(0));
  });

  it('debería devolver la ubicación en el formato del documento Servicio', () => {
    const { ubicacion, direccion, barrio } = ubicacionServicio(0);
    const esperada = ubicacionDemo(0);

    expect(ubicacion.ciudad).toBe('Madrid');
    expect(ubicacion.geo.type).toBe('Point');
    // GeoJSON guarda [lng, lat]: invertirlo pintaría el negocio en el océano.
    expect(ubicacion.geo.coordinates).toEqual(esperada.coordenadas);
    expect(ubicacion.geo.coordinates[0]).toBeLessThan(0); // longitud de Madrid
    expect(ubicacion.geo.coordinates[1]).toBeGreaterThan(39); // latitud de Madrid
    expect(direccion).toContain(esperada.direccion);
    expect(barrio).toBe(esperada.barrio);
  });

  it('no debería solapar los barrios de dos verticales distintos', () => {
    const desplazamientos = Object.values(DESPLAZAMIENTO_DEMO);
    const barriosPorVertical = desplazamientos.flatMap((inicio) =>
      [0, 1, 2].map((i) => ubicacionDemo(inicio + i).barrio),
    );

    expect(new Set(barriosPorVertical).size).toBe(barriosPorVertical.length);
  });

  it('debería declarar todas las ubicaciones con coordenadas válidas', () => {
    for (const lugar of Object.values(UBICACIONES_MADRID)) {
      const [lng, lat] = lugar.coordenadas;
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
      expect(lugar.direccion).not.toBe('');
    }
  });
});
