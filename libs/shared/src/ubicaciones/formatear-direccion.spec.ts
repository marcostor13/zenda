import { esCalleValida, esNumeroPortalValido, formatearDireccion, lineaCalle } from './formatear-direccion';

describe('formatearDireccion', () => {
  it('debería quitar partes vacías, sin letras y repetidas («1, 1, , Valencia» → «Valencia»)', () => {
    expect(formatearDireccion(['1, 1', '', 'Valencia'])).toBe('Valencia');
    expect(formatearDireccion(['1', '1', '', 'Valencia'])).toBe('Valencia');
  });

  it('debería unir una dirección completa sin comas colgando', () => {
    expect(formatearDireccion(['Calle Mayor, 12', undefined, 'Madrid'])).toBe('Calle Mayor, 12, Madrid');
    expect(formatearDireccion(['  Calle Mayor 12 ,', null, ' Madrid '])).toBe('Calle Mayor 12, Madrid');
  });

  it('debería quitar repeticiones aunque cambien mayúsculas o tildes', () => {
    expect(formatearDireccion(['Calle Sol 3', 'Valencia', 'valencia'])).toBe('Calle Sol 3, Valencia');
    expect(formatearDireccion(['Málaga', 'Malaga'])).toBe('Málaga');
  });

  it('no debería quitar la ciudad cuando forma parte del nombre de la calle', () => {
    expect(formatearDireccion(['Calle de Valencia, 5', 'Valencia'])).toBe('Calle de Valencia, 5, Valencia');
  });
});

describe('lineaCalle', () => {
  it('debería componer calle y número', () => {
    expect(lineaCalle('Calle Mayor', '12')).toBe('Calle Mayor, 12');
    expect(lineaCalle('Calle Mayor', '')).toBe('Calle Mayor');
  });

  it('debería descartar una calle que no es más que un número', () => {
    expect(lineaCalle('1', '1')).toBe('');
    expect(lineaCalle('-', undefined)).toBe('');
  });

  it('no debería repetir el número si ya va en la calle', () => {
    expect(lineaCalle('Calle Mayor 12', '12')).toBe('Calle Mayor 12');
  });
});

describe('validación de la dirección del comercio', () => {
  it('debería exigir letras en la calle', () => {
    expect(esCalleValida('Calle Mayor')).toBe(true);
    expect(esCalleValida('1')).toBe(false);
    expect(esCalleValida('  ')).toBe(false);
  });

  it('debería aceptar números de portal razonables', () => {
    for (const ok of ['12', '12 B', '12B', 's/n', 'S/N', '12-14', 'km 3', '24, 2ºB', '']) {
      expect(esNumeroPortalValido(ok)).toBe(true);
    }
    for (const mal of ['#', '***', '12 '.repeat(15)]) {
      expect(esNumeroPortalValido(mal)).toBe(false);
    }
  });
});
