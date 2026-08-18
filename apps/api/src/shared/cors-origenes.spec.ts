import { origenesPermitidos } from './cors-origenes';
import { URL_PUBLICA_POR_DEFECTO } from './url-publica';

describe('origenesPermitidos', () => {
  it('debería incluir los orígenes declarados en CORS_ORIGINS', () => {
    const origenes = origenesPermitidos(
      'https://doogking.com,https://www.doogking.com',
      undefined,
      'production',
    );

    expect(origenes).toContain('https://doogking.com');
    expect(origenes).toContain('https://www.doogking.com');
  });

  it('debería ignorar espacios y entradas vacías de la lista', () => {
    const origenes = origenesPermitidos('  https://a.com , , https://b.com ', undefined, 'production');

    expect(origenes).toContain('https://a.com');
    expect(origenes).toContain('https://b.com');
    expect(origenes).not.toContain('');
  });

  it('debería normalizar la barra final para no duplicar el mismo origen', () => {
    const origenes = origenesPermitidos('https://doogking.com/', 'https://doogking.com', 'production');

    expect(origenes.filter((o) => o === 'https://doogking.com')).toHaveLength(1);
  });

  it('debería incluir APP_URL aunque no esté en CORS_ORIGINS', () => {
    const origenes = origenesPermitidos(undefined, 'https://staging.doogking.com', 'production');

    expect(origenes).toContain('https://staging.doogking.com');
  });

  it('debería permitir los orígenes de Capacitor también en producción', () => {
    const origenes = origenesPermitidos('https://doogking.com', undefined, 'production');

    // Sin esto la app móvil se queda sin API: su Origin no es el dominio web.
    expect(origenes).toContain('capacitor://localhost');
    expect(origenes).toContain('http://localhost');
  });

  it('debería añadir los puertos de desarrollo fuera de producción', () => {
    const origenes = origenesPermitidos(undefined, undefined, 'development');

    expect(origenes).toContain('http://localhost:4200');
  });

  it('no debería añadir los puertos de desarrollo en producción', () => {
    const origenes = origenesPermitidos('https://doogking.com', undefined, 'production');

    expect(origenes).not.toContain('http://localhost:4200');
  });

  it('debería caer al dominio de producción si no hay nada configurado', () => {
    const origenes = origenesPermitidos(undefined, undefined, 'production');

    expect(origenes).toContain(URL_PUBLICA_POR_DEFECTO);
  });

  it('no debería añadir el dominio por defecto si ya hay orígenes declarados', () => {
    const origenes = origenesPermitidos('https://otro.com', undefined, 'production');

    expect(origenes).not.toContain(URL_PUBLICA_POR_DEFECTO);
  });

  it('debería devolver cada origen una sola vez', () => {
    const origenes = origenesPermitidos('http://localhost,http://localhost', undefined, 'development');

    expect(origenes).toHaveLength(new Set(origenes).size);
  });
});
