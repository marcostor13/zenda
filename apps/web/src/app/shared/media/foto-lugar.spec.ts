import { EXPLORA_IMAGES, fotoDeLugar } from './images';

const lugar = (extra: Record<string, unknown> = {}) => ({
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', tipo: 'playa', fotos: [], ...extra,
} as Parameters<typeof fotoDeLugar>[0]);

describe('fotoDeLugar', () => {
  it('debería preferir siempre la foto que subió la comunidad', () => {
    // Una foto real del sitio vale más que cualquier imagen de ambiente.
    const propia = 'https://cdn.doogking.com/playa-denia.jpg';

    expect(fotoDeLugar(lugar({ fotos: [propia] }))).toBe(propia);
  });

  it('debería dar una imagen de ambiente cuando el lugar no tiene ninguna', () => {
    // El censo llega sin fotos: sin esto, las cien fichas salían con la misma
    // imagen de respaldo y la rejilla parecía rota.
    expect(fotoDeLugar(lugar())).toContain('pexels');
  });

  it('debería dar siempre la misma foto al mismo lugar', () => {
    // Con un índice o un aleatorio, la ficha cambiaba de foto al reordenar la
    // lista o al recargar la página.
    const uno = lugar({ _id: 'abc123' });

    expect(fotoDeLugar(uno)).toBe(fotoDeLugar(uno));
  });

  it('debería repartir las fotos entre lugares distintos del mismo tipo', () => {
    const fotos = new Set(
      ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']
        .map((id) => fotoDeLugar(lugar({ _id: id }))),
    );

    expect(fotos.size).toBeGreaterThan(1);
  });

  it('debería sacar la foto del pool de su tipo', () => {
    const idsDeRio = EXPLORA_IMAGES['rio'];
    const url = fotoDeLugar(lugar({ tipo: 'rio' }));

    expect(idsDeRio.some((id) => url.includes(String(id)))).toBe(true);
  });

  it('debería tener un pool por cada tipo de lugar', () => {
    for (const tipo of ['playa', 'parque', 'restaurante', 'ruta', 'rio']) {
      expect(EXPLORA_IMAGES[tipo].length).toBeGreaterThan(0);
    }
  });

  it('no debería quedarse sin foto ante un tipo que aún no existe', () => {
    expect(fotoDeLugar(lugar({ tipo: 'mirador' }))).toContain('pexels');
  });

  it('debería pedir el ancho que se le indique', () => {
    expect(fotoDeLugar(lugar(), 320)).toContain('w=320');
  });
});
