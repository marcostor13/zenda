import { bandera, variable } from './entorno-runtime';

interface GlobalConEntorno {
  __env?: Record<string, string | undefined>;
}

describe('entorno-runtime', () => {
  const global = globalThis as GlobalConEntorno;

  afterEach(() => {
    delete global.__env;
  });

  it('debería usar el valor por defecto si no hay nada inyectado', () => {
    expect(variable('WEB_API_URL', 'http://localhost:3051/api/v1')).toBe('http://localhost:3051/api/v1');
    expect(bandera('WEB_UNDER_CONSTRUCTION', true)).toBe(true);
  });

  it('debería preferir el valor inyectado por el contenedor', () => {
    global.__env = { WEB_API_URL: 'https://api.doogking.com/api/v1' };

    expect(variable('WEB_API_URL', 'http://localhost:3051/api/v1')).toBe('https://api.doogking.com/api/v1');
  });

  it('debería tratar la variable vacía como no declarada', () => {
    // Una variable declarada sin valor en Coolify no debe dejar la web sin API.
    global.__env = { WEB_API_URL: '' };

    expect(variable('WEB_API_URL', 'http://localhost:3051/api/v1')).toBe('http://localhost:3051/api/v1');
  });

  it('debería leer las banderas como texto: sólo true o 1 activan', () => {
    global.__env = { WEB_UNDER_CONSTRUCTION: 'false' };
    expect(bandera('WEB_UNDER_CONSTRUCTION', true)).toBe(false);

    global.__env = { WEB_UNDER_CONSTRUCTION: 'true' };
    expect(bandera('WEB_UNDER_CONSTRUCTION', false)).toBe(true);

    global.__env = { WEB_UNDER_CONSTRUCTION: '1' };
    expect(bandera('WEB_UNDER_CONSTRUCTION', false)).toBe(true);

    // Cualquier otra cosa desactiva: un "sí" mal escrito no debe dejar la web
    // tapada tras la pantalla de "muy pronto".
    global.__env = { WEB_UNDER_CONSTRUCTION: 'sí' };
    expect(bandera('WEB_UNDER_CONSTRUCTION', true)).toBe(false);
  });
});
