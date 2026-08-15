import { puntosGeolocalizados } from './motor-mapa';

describe('puntosGeolocalizados', () => {
  it('debería descartar los servicios sin coordenadas utilizables', () => {
    // Un servicio sin geocodificar llega con NaN; pintarlo mandaría el pin al
    // punto (0,0), en mitad del Atlántico.
    const puntos = puntosGeolocalizados([
      { id: 'con', lat: 40.4168, lng: -3.7038 },
      { id: 'sin', lat: NaN, lng: NaN },
      { id: 'medio', lat: 41.38, lng: NaN },
    ]);

    expect(puntos.map((p) => p.id)).toEqual(['con']);
  });

  it('debería conservar el orden de los que sí tienen coordenadas', () => {
    const puntos = puntosGeolocalizados([
      { id: 'b', lat: 1, lng: 1 },
      { id: 'a', lat: 2, lng: 2 },
    ]);

    expect(puntos.map((p) => p.id)).toEqual(['b', 'a']);
  });
});
