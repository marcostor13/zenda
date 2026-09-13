import { claveUbicacion, distanciaEdicion, normalizarUbicacion } from './normalizar-ubicacion';

describe('normalizarUbicacion', () => {
  it('debería quitar tildes y pasar a minúsculas', () => {
    expect(normalizarUbicacion('Málaga')).toBe('malaga');
    expect(normalizarUbicacion('CASTELLÓ')).toBe('castello');
  });

  it('debería convertir guiones, apóstrofes y puntos en espacios simples', () => {
    expect(normalizarUbicacion('Vila-real')).toBe('vila real');
    expect(normalizarUbicacion("L'Hospitalet  de   Llobregat")).toBe('l hospitalet de llobregat');
    expect(normalizarUbicacion('Vitoria-Gasteiz')).toBe('vitoria gasteiz');
  });

  it('debería dejar la eñe como n, que es como la teclea quien no la escribe', () => {
    expect(normalizarUbicacion('A Coruña')).toBe('a coruna');
  });
});

describe('claveUbicacion', () => {
  it('debería juntar las palabras: la separación es lo que no se respeta al escribir', () => {
    expect(claveUbicacion('Vila-real')).toBe('vilareal');
    expect(claveUbicacion('villa real')).toBe('villareal');
    expect(claveUbicacion('Castellón de la Plana')).toBe('castellondelaplana');
  });

  it('debería descartar el artículo inicial', () => {
    expect(claveUbicacion('El Ejido')).toBe(claveUbicacion('Ejido'));
    expect(claveUbicacion('A Coruña')).toBe(claveUbicacion('Coruña'));
    expect(claveUbicacion("L'Hospitalet")).toBe(claveUbicacion('Hospitalet'));
  });

  it('no debería descartar el artículo cuando es el nombre entero', () => {
    expect(claveUbicacion('La')).toBe('la');
  });

  it('debería devolver cadena vacía para un texto sin letras', () => {
    expect(claveUbicacion('   ')).toBe('');
    expect(claveUbicacion('—')).toBe('');
  });
});

describe('distanciaEdicion', () => {
  it('debería contar una letra de diferencia', () => {
    expect(distanciaEdicion('villareal', 'villarreal')).toBe(1);
    expect(distanciaEdicion('zaragosa', 'zaragoza')).toBe(1);
  });

  it('debería cortar en cuanto supera el tope, sin recorrer la matriz entera', () => {
    expect(distanciaEdicion('madrid', 'barcelona', 2)).toBeGreaterThan(2);
  });

  it('debería ser cero para textos idénticos', () => {
    expect(distanciaEdicion('denia', 'denia')).toBe(0);
  });
});
