import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { VERTICALES_UI, rutaDeVertical, verticalUi } from './verticales.config';

describe('verticales.config', () => {
  it('debería cubrir todas las categorías del dominio', () => {
    const keys = VERTICALES_UI.map((v) => v.key).sort();
    expect(keys).toEqual(Object.values(VerticalKey).sort());
  });

  it('debería usar las etiquetas del dominio compartido', () => {
    for (const v of VERTICALES_UI) {
      expect(v.label).toBe(VERTICAL_LABELS[v.key]);
    }
  });

  it('debería tener una ruta y un icono propio por categoría', () => {
    for (const v of VERTICALES_UI) {
      expect(v.route).toBe(`/${v.key}`);
      expect(v.icono).toBe(`/icons/${v.key}.svg`);
    }
  });

  it('debería reservar por noches solo alojamiento y hoteles', () => {
    const porNoches = VERTICALES_UI.filter((v) => v.reservaPorNoches).map((v) => v.key);
    expect(porNoches).toEqual([VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES]);
  });

  it('debería resolver la config de una categoría por su clave', () => {
    expect(verticalUi(VerticalKey.PELUQUERIA).labelCorto).toBe('Peluquería');
    expect(rutaDeVertical(VerticalKey.VETERINARIA)).toBe('/veterinaria');
  });

  it('debería caer en alojamiento cuando la clave no existe', () => {
    expect(verticalUi('inventado').key).toBe(VerticalKey.ALOJAMIENTO);
    expect(rutaDeVertical(null)).toBe('/alojamiento');
    expect(rutaDeVertical(undefined)).toBe('/alojamiento');
  });
});
