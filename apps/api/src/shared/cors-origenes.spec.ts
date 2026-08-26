import { origenesPermitidos } from './cors-origenes';

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
    // `https://localhost` es el esquema por defecto de Capacitor desde la v4 y
    // el que declara capacitor.config.ts: faltaba, y el APK instalado recibía
    // un CORS bloqueado en todas las llamadas.
    expect(origenes).toContain('https://localhost');
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

  describe('dominios propios', () => {
    it('debería permitir los tres dominios de Doogking sin configurar nada', () => {
      // Caída real: al cerrar el CORS, el despliegue no tenía CORS_ORIGINS ni un
      // APP_URL con el dominio bueno y el API rechazó a su propia web.
      const origenes = origenesPermitidos(undefined, undefined, 'production');

      for (const dominio of ['doogking.com', 'doogking.eu', 'doogking.es']) {
        expect(origenes).toContain(`https://${dominio}`);
        expect(origenes).toContain(`https://www.${dominio}`);
      }
    });

    it('debería seguir permitiéndolos aunque se declaren otros orígenes', () => {
      // Declarar un dominio de cliente no puede dejar fuera al propio.
      const origenes = origenesPermitidos('https://otro.com', undefined, 'production');

      expect(origenes).toContain('https://otro.com');
      expect(origenes).toContain('https://doogking.com');
    });

    it('debería permitirlos también en desarrollo', () => {
      const origenes = origenesPermitidos(undefined, undefined, 'development');

      expect(origenes).toContain('https://doogking.com');
      expect(origenes).toContain('http://localhost:4200');
    });
  });

  it('debería devolver cada origen una sola vez', () => {
    const origenes = origenesPermitidos('http://localhost,http://localhost', undefined, 'development');

    expect(origenes).toHaveLength(new Set(origenes).size);
  });
});
