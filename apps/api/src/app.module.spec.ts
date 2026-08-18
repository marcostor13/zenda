import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from './app.module';
import { AuthController } from './core/auth/auth.controller';
import { AiSearchController } from './core/ai-search/ai-search.controller';
import { GeoController } from './core/geo/geo.controller';
import { ListaEsperaController } from './core/lista-espera/lista-espera.controller';
import { PaymentsController } from './core/payments/payments.controller';
import { UploadController } from './core/upload/upload.controller';

/** Claves que `@Throttle`/`@SkipThrottle` escriben para el limitador `default`. */
const LIMITE = 'THROTTLER:LIMITdefault';
const TTL = 'THROTTLER:TTLdefault';
const OMITIDO = 'THROTTLER:SKIPdefault';

const limiteDeClase = (controller: object): number | undefined =>
  Reflect.getMetadata(LIMITE, controller) as number | undefined;

const limiteDeMetodo = (controller: { prototype: object }, metodo: string): number | undefined =>
  Reflect.getMetadata(LIMITE, (controller.prototype as Record<string, object>)[metodo]) as
    | number
    | undefined;

const omiteLimite = (controller: { prototype: object }, metodo: string): boolean | undefined =>
  Reflect.getMetadata(OMITIDO, (controller.prototype as Record<string, object>)[metodo]) as
    | boolean
    | undefined;

/**
 * Estos tests vigilan una medida de seguridad, no una funcionalidad: sin rate
 * limiting el login es fuerza-bruteable y los proxies a Google y DeepSeek los
 * factura cualquiera. Quitar un decorador debe romper la suite, no pasar
 * inadvertido en una revisión.
 */
describe('AppModule — limitación de peticiones', () => {
  it('debería registrar ThrottlerGuard como guard global', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as Array<{
      provide?: symbol | string;
      useClass?: unknown;
    }>;

    const guardGlobal = providers.find((p) => p.provide === APP_GUARD);
    expect(guardGlobal?.useClass).toBe(ThrottlerGuard);
  });

  it('debería registrar el módulo de limitación con un techo global por minuto', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as Array<{ module?: unknown }>;
    const throttler = imports.find(
      (i) => (i as { module?: { name?: string } })?.module?.name === 'ThrottlerModule',
    );

    expect(throttler).toBeDefined();
  });

  describe('endpoints públicos que tocan credenciales o cuestan dinero', () => {
    it('debería limitar todo el controller de auth', () => {
      expect(limiteDeClase(AuthController)).toBe(10);
      expect(Reflect.getMetadata(TTL, AuthController)).toBe(60_000);
    });

    it('debería limitar aún más el reenvío de verificación, que envía correo real', () => {
      expect(limiteDeMetodo(AuthController, 'reenviarVerificacion')).toBe(3);
    });

    it('debería limitar la búsqueda con IA, que consume tokens de DeepSeek', () => {
      expect(limiteDeClase(AiSearchController)).toBe(5);
    });

    it('debería limitar el proxy de geo, que se factura contra Google Places y Routes', () => {
      expect(limiteDeClase(GeoController)).toBe(60);
    });

    it('debería limitar el alta en la lista de espera, que escribe en BD sin sesión', () => {
      expect(limiteDeMetodo(ListaEsperaController, 'suscribir')).toBe(5);
    });
  });

  describe('endpoints exentos', () => {
    it('no debería limitar el webhook de Stripe: bloquearlo perdería confirmaciones de pago', () => {
      expect(omiteLimite(PaymentsController, 'webhook')).toBe(true);
    });

    it('no debería limitar la descarga de imágenes: un listado pinta decenas de golpe', () => {
      expect(omiteLimite(UploadController, 'obtenerImagen')).toBe(true);
    });
  });
});
