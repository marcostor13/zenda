import { aSlug, pareceObjectId, slugDeLugar, slugLibre } from './slug.util';

describe('aSlug', () => {
  it('debería pasar a minúsculas y unir con guiones', () => {
    expect(aSlug('Parque Central')).toBe('parque-central');
  });

  it('debería quitar las tildes', () => {
    expect(aSlug('Río Júcar')).toBe('rio-jucar');
  });

  it('debería quitar la eñe y la cedilla', () => {
    expect(aSlug('Peñíscola')).toBe('peniscola');
    expect(aSlug('Alaçant')).toBe('alacant');
  });

  it('debería descartar los signos de puntuación', () => {
    expect(aSlug('Playa de «El Saler» (norte)')).toBe('playa-de-el-saler-norte');
  });

  it('no debería dejar guiones al principio ni al final', () => {
    expect(aSlug('  ¡Playa!  ')).toBe('playa');
  });

  it('no debería dejar guiones seguidos', () => {
    expect(aSlug('Playa   ---   Norte')).toBe('playa-norte');
  });

  /** Un slug larguísimo deja de ser legible y empieza a estorbar. */
  it('debería recortar sin dejar un guion colgando al final', () => {
    const resultado = aSlug('a'.repeat(68) + ' bcd');

    expect(resultado.length).toBeLessThanOrEqual(70);
    expect(resultado.endsWith('-')).toBe(false);
  });
});

describe('slugDeLugar', () => {
  /**
   * Hay decenas de «Parque Central» en España: sin el municipio, el segundo
   * acabaría en `parque-central-2`, que no le dice nada a nadie.
   */
  it('debería incluir el municipio para distinguir sitios homónimos', () => {
    expect(slugDeLugar('Río Júcar', 'Riola')).toBe('rio-jucar-riola');
  });

  it('debería funcionar sin municipio', () => {
    expect(slugDeLugar('Río Júcar')).toBe('rio-jucar');
  });

  it('debería devolver un slug de respaldo si el nombre no deja nada usable', () => {
    expect(slugDeLugar('«»', '')).toBe('lugar');
  });
});

describe('slugLibre', () => {
  it('debería devolver la base si está libre', async () => {
    const resultado = await slugLibre('rio-jucar-riola', async () => false);

    expect(resultado).toBe('rio-jucar-riola');
  });

  it('debería numerar a partir del dos cuando la base está ocupada', async () => {
    const ocupados = new Set(['playa-norte', 'playa-norte-2']);
    const resultado = await slugLibre('playa-norte', async (c) => ocupados.has(c));

    expect(resultado).toBe('playa-norte-3');
  });

  /** Llegar aquí significa que algo va mal; mejor fallar que probar para siempre. */
  it('debería rendirse tras muchos intentos en vez de quedarse en bucle', async () => {
    await expect(slugLibre('x', async () => true)).rejects.toThrow('No se encontró un slug libre');
  });
});

describe('pareceObjectId', () => {
  it('debería reconocer un id de Mongo', () => {
    expect(pareceObjectId('6a8451c2756a745fe5e230eb')).toBe(true);
  });

  it('no debería confundir un slug con un id', () => {
    expect(pareceObjectId('rio-jucar-riola')).toBe(false);
  });

  /** Un slug de 24 caracteres hexadecimales sería ambiguo; no existe por el guion. */
  it('no debería aceptar algo de otra longitud', () => {
    expect(pareceObjectId('6a8451c2')).toBe(false);
  });
});
