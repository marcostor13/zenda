import { REDES_SOCIALES, REDES_SOCIALES_DESTACADAS } from './redes-sociales.catalogo';

describe('redes-sociales.catalogo', () => {
  it('debería apuntar TikTok a la cuenta de la marca, con el punto', () => {
    // `@doogking` y `@doogking.com` son dos usuarios distintos en TikTok; el
    // primero no es de Doogking.
    const tiktok = REDES_SOCIALES.find((red) => red.icono === 'tiktok');

    expect(tiktok?.url).toBe('https://www.tiktok.com/@doogking.com');
  });

  it('debería llevar a un perfil por red, sin repetir ninguna', () => {
    const iconos = REDES_SOCIALES.map((red) => red.icono);

    expect(new Set(iconos).size).toBe(iconos.length);
  });

  it('debería servir todas las URLs por https', () => {
    for (const red of REDES_SOCIALES) {
      expect(red.url.startsWith('https://')).toBe(true);
    }
  });

  it('debería nombrar cada perfil, para el texto accesible del enlace', () => {
    for (const red of REDES_SOCIALES) {
      expect(red.nombre.trim().length).toBeGreaterThan(0);
    }
  });

  describe('perfiles destacados', () => {
    it('debería ser un subconjunto de la lista completa, no una copia aparte', () => {
      // Es justo la duplicación que hacía que la portada y «próximamente»
      // enseñaran perfiles de Instagram distintos.
      for (const red of REDES_SOCIALES_DESTACADAS) {
        expect(REDES_SOCIALES).toContain(red);
      }
    });

    it('debería destacar Instagram, Facebook y TikTok, en ese orden', () => {
      expect(REDES_SOCIALES_DESTACADAS.map((red) => red.icono))
        .toEqual(['instagram', 'facebook', 'tiktok']);
    });
  });
});
