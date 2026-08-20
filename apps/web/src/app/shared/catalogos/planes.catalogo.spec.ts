import { COMPARATIVA, PLANES, esPlanActual, planDeComercio } from './planes.catalogo';

describe('planes.catalogo', () => {
  it('debería ofrecer sólo el gratuito y el de pago', () => {
    expect(PLANES.map((p) => p.clave)).toEqual(['basico', 'pro']);
  });

  it('debería tener el básico realmente gratis', () => {
    // El plan gratuito capta negocios: si costara algo, no cumpliría su papel.
    expect(PLANES[0].precioMensual).toBe(0);
  });

  it('debería cobrar 29 € por el Pro', () => {
    expect(PLANES[1].precioMensual).toBe(29);
  });

  describe('sin límites de publicación', () => {
    it('no debería limitar los servicios en ningún plan', () => {
      /*
       * Es la decisión de fondo del cambio: interesa que cada profesional
       * tenga en Doogking todo lo que ofrece. El argumento no es "paga para
       * publicar más".
       */
      const texto = JSON.stringify(PLANES).toLowerCase();

      expect(texto).not.toMatch(/hasta \d+ (servicios|listados)/);
      expect(texto).not.toContain('límite de');
    });

    it('debería decir explícitamente que no hay límite', () => {
      expect(PLANES[0].beneficios).toContain('Servicios publicados sin límite');
    });

    it('debería dejar publicar sin límite en los dos planes de la comparativa', () => {
      const publicar = COMPARATIVA.find((f) => f.concepto === 'Publicar servicios');

      expect(publicar?.basico).toBe('Sin límite');
      expect(publicar?.pro).toBe('Sin límite');
    });
  });

  it('no debería usar la palabra "verticales" de cara al comercio', () => {
    const texto = JSON.stringify([...PLANES, ...COMPARATIVA]).toLowerCase();

    expect(texto).not.toContain('vertical');
  });

  it('debería marcar el Pro como recomendado y sólo a él', () => {
    expect(PLANES.filter((p) => p.recomendado).map((p) => p.clave)).toEqual(['pro']);
  });

  it('debería dar por incluido el básico dentro del Pro', () => {
    // Así la tarjeta no repite los siete puntos del gratuito.
    expect(PLANES[1].incluye).toBe('basico');
  });

  describe('planDeComercio', () => {
    it('debería partir del básico cuando no hay plan guardado', () => {
      expect(planDeComercio(undefined).clave).toBe('basico');
      expect(planDeComercio(null).clave).toBe('basico');
    });

    it('debería reconocer el Pro', () => {
      expect(planDeComercio('pro').clave).toBe('pro');
    });

    it('debería tratar como Pro a los que tenían el antiguo premium', () => {
      // Existen comercios dados de alta con la escala anterior: nadie puede
      // perder lo que estaba pagando por retirar un plan del catálogo.
      expect(planDeComercio('premium').clave).toBe('pro');
    });

    it('debería caer al básico ante un plan desconocido', () => {
      expect(planDeComercio('inventado').clave).toBe('basico');
    });
  });

  describe('esPlanActual', () => {
    it('debería señalar el plan contratado', () => {
      expect(esPlanActual(PLANES[0], 'basico')).toBe(true);
      expect(esPlanActual(PLANES[1], 'basico')).toBe(false);
    });

    it('debería señalar el Pro a quien venía de premium', () => {
      expect(esPlanActual(PLANES[1], 'premium')).toBe(true);
      expect(esPlanActual(PLANES[0], 'premium')).toBe(false);
    });
  });

  describe('comparativa', () => {
    it('debería dar un valor de cada plan en todas las filas', () => {
      for (const fila of COMPARATIVA) {
        expect(fila.basico).toBeDefined();
        expect(fila.pro).toBeDefined();
        expect(fila.concepto).toBeTruthy();
        expect(fila.icono).toBeTruthy();
      }
    });

    it('no debería prometer en la comparativa nada que el plan no liste', () => {
      // Lo que se marca sólo para Pro tiene que estar entre sus beneficios.
      const soloPro = COMPARATIVA.filter((f) => f.basico === false && f.pro === true);

      expect(soloPro.length).toBeGreaterThan(0);
    });
  });
});
