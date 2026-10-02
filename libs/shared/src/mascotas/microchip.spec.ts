import { MICROCHIP_OPCIONAL_REGEX, esMicrochipValido, normalizarMicrochip } from './microchip';

describe('microchip (ISO 11784/11785)', () => {
  it('debería aceptar exactamente 15 dígitos', () => {
    expect(esMicrochipValido('941000012345678')).toBe(true);
  });

  it('debería rechazar menos o más de 15 dígitos y letras', () => {
    expect(esMicrochipValido('94100001234567')).toBe(false);
    expect(esMicrochipValido('9410000123456789')).toBe(false);
    expect(esMicrochipValido('94100001234567A')).toBe(false);
  });

  it('debería aceptar el número agrupado con espacios, puntos o guiones', () => {
    expect(normalizarMicrochip('941 000.012-345678')).toBe('941000012345678');
    expect(esMicrochipValido('941 000 012 345 678')).toBe(true);
  });

  it('debería admitir la cadena vacía en la versión opcional (quitarlo de la ficha)', () => {
    expect(MICROCHIP_OPCIONAL_REGEX.test('')).toBe(true);
    expect(MICROCHIP_OPCIONAL_REGEX.test('123')).toBe(false);
  });
});
