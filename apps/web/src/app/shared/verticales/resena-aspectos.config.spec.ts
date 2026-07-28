import { VerticalKey } from 'shared';
import { ASPECTOS_POR_VERTICAL, aspectosDeVertical } from './resena-aspectos.config';

describe('resena-aspectos.config', () => {
  it('debería cubrir todas las categorías del dominio', () => {
    const keys = Object.keys(ASPECTOS_POR_VERTICAL).sort();
    expect(keys).toEqual(Object.values(VerticalKey).sort());
  });

  it('debería tener al menos un criterio por categoría', () => {
    for (const key of Object.values(VerticalKey)) {
      expect(ASPECTOS_POR_VERTICAL[key].length).toBeGreaterThan(0);
    }
  });

  it('debería devolver los criterios de peluquería según la HU-11.4', () => {
    const claves = aspectosDeVertical(VerticalKey.PELUQUERIA).map((a) => a.key);
    expect(claves).toEqual(['resultado', 'tratoAlPerro', 'puntualidad']);
  });

  it('debería devolver un set genérico si la categoría no existe', () => {
    const aspectos = aspectosDeVertical('no-existe');
    expect(aspectos.length).toBeGreaterThan(0);
  });

  it('debería devolver un set genérico si no se pasa vertical', () => {
    const aspectos = aspectosDeVertical(undefined);
    expect(aspectos.length).toBeGreaterThan(0);
  });
});
