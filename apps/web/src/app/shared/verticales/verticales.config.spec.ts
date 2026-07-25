import { VerticalKey, VERTICAL_LABELS } from 'shared';
import {
  VERTICALES_UI, rutaDeVertical, subtitularDeVertical, titularDeVertical, verticalUi,
} from './verticales.config';

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

  it('debería distinguir el alojamiento canino de un hotel pet-friendly', () => {
    expect(verticalUi(VerticalKey.ALOJAMIENTO).labelCorto).toBe('Alojamiento canino');
  });

  it('debería definir titular y subtitular a la vez, nunca solo uno', () => {
    for (const v of VERTICALES_UI) {
      expect(Boolean(v.titular)).toBe(Boolean(v.subtitular));
    }
  });

  it('debería exponer el copy de marca de los verticales revisados', () => {
    expect(titularDeVertical(VerticalKey.TRANSPORTE)).toBe('MÁS QUE UN TRANSPORTE');
    expect(subtitularDeVertical(VerticalKey.TRANSPORTE)).toBe('Su bienestar es el destino más importante.');
    expect(titularDeVertical(VerticalKey.VETERINARIA)).toBe('VETERINARIOS DE CONFIANZA');
    expect(titularDeVertical(VerticalKey.PELUQUERIA)).toBe('El cuidado que merece');
    expect(titularDeVertical(VerticalKey.ALOJAMIENTO)).toBe('Más que un alojamiento');
  });

  it('debería caer en label y descripción cuando el vertical no tiene copy propio', () => {
    const sinCopy = VERTICALES_UI.find((v) => !v.titular);
    expect(sinCopy).toBeDefined();
    expect(titularDeVertical(sinCopy!.key)).toBe(sinCopy!.label);
    expect(subtitularDeVertical(sinCopy!.key)).toBe(sinCopy!.descripcion);
  });

  it('no debería anunciar servicios que Doogking no intermedia', () => {
    const vet = verticalUi(VerticalKey.VETERINARIA);
    const copy = `${vet.descripcion} ${vet.claim} ${vet.subtitular}`.toLowerCase();
    expect(copy).not.toContain('cirugía');
    expect(copy).not.toContain('dermatología');
  });

  it('debería caer en alojamiento cuando la clave no existe', () => {
    expect(verticalUi('inventado').key).toBe(VerticalKey.ALOJAMIENTO);
    expect(rutaDeVertical(null)).toBe('/alojamiento');
    expect(rutaDeVertical(undefined)).toBe('/alojamiento');
  });
});
