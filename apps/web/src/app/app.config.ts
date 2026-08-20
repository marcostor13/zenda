import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    /**
     * Sin esto Angular deja el scroll donde estaba al cambiar de ruta: se
     * abria una ficha desde la mitad del listado y la ficha aparecia empezada
     * por la mitad. `enabled` sube arriba en cada navegacion nueva y devuelve
     * la posicion exacta al volver atras, que es lo que hace que un listado
     * largo se pueda recorrer sin perder el sitio.
     */
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'enabled',
      anchorScrolling: 'enabled',
    })),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
