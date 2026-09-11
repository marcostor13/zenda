import { almacenLocal, almacenSesion, esNavegador } from './almacen';

describe('almacen', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('debería usar el localStorage real cuando existe', () => {
    almacenLocal().setItem('dk_prueba', 'valor');

    expect(localStorage.getItem('dk_prueba')).toBe('valor');
    expect(almacenLocal().getItem('dk_prueba')).toBe('valor');
  });

  it('debería usar el sessionStorage real cuando existe', () => {
    almacenSesion().setItem('dk_prueba', 'valor');

    expect(sessionStorage.getItem('dk_prueba')).toBe('valor');
  });

  /**
   * El caso del render de servidor: en Node no hay `localStorage`, y varios
   * servicios de raíz lo leen al construirse. Sin este respaldo, la primera
   * petición reventaba antes de pintar nada.
   */
  it('debería devolver un almacén vacío cuando no existe el del navegador', () => {
    const global = globalThis as unknown as Record<string, unknown>;
    const original = global['localStorage'];
    delete global['localStorage'];

    try {
      const almacen = almacenLocal();
      almacen.setItem('dk_prueba', 'valor');

      expect(almacen.getItem('dk_prueba')).toBeNull();
      expect(almacen.length).toBe(0);
      expect(almacen.key(0)).toBeNull();
      expect(() => almacen.removeItem('dk_prueba')).not.toThrow();
      expect(() => almacen.clear()).not.toThrow();
    } finally {
      global['localStorage'] = original;
    }
  });

  /**
   * Safari en modo privado con las cookies bloqueadas lanza una excepción al
   * *acceder* a la propiedad, no al escribir.
   */
  it('debería devolver un almacén vacío cuando el navegador prohíbe el acceso', () => {
    const global = globalThis as unknown as Record<string, unknown>;
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('acceso denegado', 'SecurityError');
      },
    });

    try {
      expect(() => almacenLocal().getItem('dk_prueba')).not.toThrow();
      expect(almacenLocal().getItem('dk_prueba')).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete global['localStorage'];
    }
  });

  it('debería reconocer el navegador cuando hay window y document', () => {
    expect(esNavegador()).toBe(true);
  });
});
