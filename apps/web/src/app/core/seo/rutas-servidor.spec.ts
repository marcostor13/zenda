import { destinoDeSlug, esRutaPrivada, fichaPorId, urlFichaApi } from './rutas-servidor';

describe('rutas-servidor', () => {
  describe('fichaPorId', () => {
    it('debería reconocer una ficha de servicio pedida por id', () => {
      expect(fichaPorId('/alojamiento/6aa45f57779263b987ae2409'))
        .toEqual({ segmento: 'alojamiento', id: '6aa45f57779263b987ae2409' });
    });

    it('debería reconocer una ficha de Explora pedida por id, con barra final', () => {
      expect(fichaPorId('/explora/6A8451C2756A745FE5E230EB/'))
        .toEqual({ segmento: 'explora', id: '6a8451c2756a745fe5e230eb' });
    });

    it('no debería tocar una ficha que ya va por slug', () => {
      expect(fichaPorId('/alojamiento/reino-canino-valencia')).toBeNull();
    });

    it('no debería tocar rutas que no son de ficha', () => {
      expect(fichaPorId('/perros/6aa45f57779263b987ae2409')).toBeNull();
      expect(fichaPorId('/transporte/viaje/6aa45f57779263b987ae2409')).toBeNull();
    });
  });

  describe('urlFichaApi', () => {
    it('debería pedir el servicio con su vertical', () => {
      expect(urlFichaApi('https://api.doogking.com/api/v1/', { segmento: 'veterinaria', id: 'abc' }))
        .toBe('https://api.doogking.com/api/v1/catalog/servicios/abc?vertical=veterinaria');
    });

    it('debería pedir el lugar en Explora', () => {
      expect(urlFichaApi('/api/v1', { segmento: 'explora', id: 'abc' })).toBe('/api/v1/lugares/abc');
    });
  });

  describe('destinoDeSlug', () => {
    it('debería conservar la consulta', () => {
      expect(destinoDeSlug({ segmento: 'alojamiento', id: 'x' }, 'reino-canino-valencia', '?desde=2026-10-01'))
        .toBe('/alojamiento/reino-canino-valencia?desde=2026-10-01');
    });
  });

  describe('esRutaPrivada', () => {
    it.each(['/admin', '/comercio/agenda', '/perfil', '/reservas/DK-123', '/auth/login', '/transporte/viaje/reserva', '/buscador'])(
      'debería marcar %s como privada',
      (ruta) => expect(esRutaPrivada(ruta)).toBe(true),
    );

    it.each(['/', '/alojamiento', '/alojamiento/reino-canino', '/transporte', '/explora/planificador', '/comercios-amigos'])(
      'no debería marcar %s como privada',
      (ruta) => expect(esRutaPrivada(ruta)).toBe(false),
    );
  });
});
