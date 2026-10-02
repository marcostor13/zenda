import { Router } from '@angular/router';
import { debeIrAlSlug, irAlSlug } from './url-canonica';

describe('url-canonica', () => {
  it('debería redirigir si se entró por id y la ficha tiene slug', () => {
    expect(debeIrAlSlug('6aa45f57779263b987ae2409', 'reino-canino-valencia')).toBe(true);
  });

  it('no debería redirigir si ya se está en el slug', () => {
    expect(debeIrAlSlug('reino-canino-valencia', 'reino-canino-valencia')).toBe(false);
  });

  it('no debería redirigir si la ficha aún no tiene slug', () => {
    expect(debeIrAlSlug('6aa45f57779263b987ae2409', undefined)).toBe(false);
    expect(debeIrAlSlug(null, 'reino')).toBe(false);
  });

  it('debería reemplazar la entrada del historial conservando la consulta', () => {
    const router = { navigate: jest.fn().mockResolvedValue(true) } as unknown as jest.Mocked<Router>;
    irAlSlug(router, ['/alojamiento', 'reino-canino-valencia']);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/alojamiento', 'reino-canino-valencia'],
      { replaceUrl: true, queryParamsHandling: 'preserve' },
    );
  });
});
