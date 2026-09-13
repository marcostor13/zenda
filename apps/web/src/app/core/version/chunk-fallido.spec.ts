import { esErrorDeChunk } from './chunk-fallido';

describe('esErrorDeChunk', () => {
  it('debería reconocer el error de Chrome al pedir un módulo que ya no existe', () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://doogking.com/chunk-5KJ2X9QA.js',
    );

    expect(esErrorDeChunk(error)).toBe(true);
  });

  it('debería reconocer el error de Safari', () => {
    // Safari no dice "failed to fetch": avisa de que lo que llegó no es un
    // módulo, que es justo lo que pasa cuando el servidor devuelve una página.
    expect(esErrorDeChunk(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('debería reconocer el error de Firefox', () => {
    expect(esErrorDeChunk(new TypeError('error loading dynamically imported module'))).toBe(true);
  });

  it('debería reconocer el ChunkLoadError por su nombre', () => {
    const error = new Error('Loading chunk 42 failed.');
    error.name = 'ChunkLoadError';

    expect(esErrorDeChunk(error)).toBe(true);
  });

  it('debería mirar también dentro de la causa', () => {
    // El router envuelve el fallo original antes de publicarlo.
    const error = new Error('Navigation failed', {
      cause: new TypeError('Failed to fetch dynamically imported module'),
    });

    expect(esErrorDeChunk(error)).toBe(true);
  });

  it('no debería confundir un error normal con uno de carga', () => {
    // Recargar la página por un 404 del API dejaría al usuario en un bucle.
    expect(esErrorDeChunk(new Error('Http failure response: 404 Not Found'))).toBe(false);
    expect(esErrorDeChunk(null)).toBe(false);
    expect(esErrorDeChunk(undefined)).toBe(false);
    expect(esErrorDeChunk({ mensaje: 'loading chunk' })).toBe(false);
  });
});
