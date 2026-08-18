import { escaparRegex, regexLiteral } from './regex';

describe('escaparRegex', () => {
  it('debería dejar intacto un texto sin metacaracteres', () => {
    expect(escaparRegex('Valencia')).toBe('Valencia');
  });

  it('debería escapar los metacaracteres de una expresión regular', () => {
    expect(escaparRegex('a+b')).toBe('a\\+b');
    expect(escaparRegex('(a)')).toBe('\\(a\\)');
    expect(escaparRegex('a.b*c?')).toBe('a\\.b\\*c\\?');
  });

  it('debería escapar la propia barra invertida', () => {
    expect(escaparRegex('a\\b')).toBe('a\\\\b');
  });

  it('debería admitir el texto vacío', () => {
    expect(escaparRegex('')).toBe('');
  });
});

describe('regexLiteral', () => {
  it('debería casar el texto tal cual, sin distinguir mayúsculas', () => {
    expect(regexLiteral('valencia').test('Valencia')).toBe(true);
  });

  it('debería tratar los metacaracteres como texto, no como patrón', () => {
    // Sin escapar, /a+/ casaría con "aaa"; escapado sólo casa el literal "a+".
    expect(regexLiteral('a+').test('aaa')).toBe(false);
    expect(regexLiteral('a+').test('a+b')).toBe(true);
  });

  it('debería neutralizar un patrón de retroceso catastrófico', () => {
    // `(a+)+$` sin escapar cuelga el event loop con una entrada suficientemente
    // larga; escapado es sólo una cadena de ocho caracteres que no casa.
    const entrada = `${'a'.repeat(40)}!`;
    const inicio = Date.now();

    expect(regexLiteral('(a+)+$').test(entrada)).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});
