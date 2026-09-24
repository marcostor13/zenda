import { EspecieMascota, HitoViaje, normalizarEspecie, normalizarHitoViaje } from './transporte.catalogo';

describe('normalizarEspecie', () => {
  it.each([
    ['perro', EspecieMascota.PERRO],
    ['Perro', EspecieMascota.PERRO],
    [' Gato ', EspecieMascota.GATO],
    ['CONEJO', EspecieMascota.CONEJO],
    ['reptil', EspecieMascota.REPTIL],
  ])('debería traducir «%s» al valor del catálogo', (entrada, esperada) => {
    expect(normalizarEspecie(entrada)).toBe(esperada);
  });

  it('debería ignorar las tildes', () => {
    expect(normalizarEspecie('Avé')).toBe(EspecieMascota.AVE);
  });

  it.each([undefined, null, '', '   '])('debería suponer perro cuando la ficha no trae especie (%p)', (entrada) => {
    expect(normalizarEspecie(entrada)).toBe(EspecieMascota.PERRO);
  });

  it('debería llevar lo desconocido a «otro»', () => {
    expect(normalizarEspecie('iguana')).toBe(EspecieMascota.OTRO);
  });
});

describe('normalizarHitoViaje', () => {
  it('debería traducir el hito antiguo en_ruta a en_trayecto', () => {
    expect(normalizarHitoViaje('en_ruta')).toBe(HitoViaje.EN_TRAYECTO);
  });

  it('debería dejar intactos los demás hitos', () => {
    expect(normalizarHitoViaje(HitoViaje.RECOGIDA)).toBe(HitoViaje.RECOGIDA);
    expect(normalizarHitoViaje('desconocido')).toBe('desconocido');
  });
});
