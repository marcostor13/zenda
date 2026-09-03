import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { conexionInterceptor } from './core/interceptors/conexion.interceptor';
import { idiomaInterceptor } from './core/interceptors/idioma.interceptor';
import { I18nService } from './core/i18n/i18n.service';
import { proveerLocaleAngular } from './core/i18n/locale-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    /**
     * Deja cargado el diccionario del idioma guardado antes de pintar la
     * primera pantalla: sin esto, un usuario en alemán vería un fogonazo de
     * español mientras llega el chunk. `iniciar()` nunca rechaza —si la
     * descarga falla se sigue en español—, así que no puede bloquear el
     * arranque de la aplicación.
     */
    provideAppInitializer(() => inject(I18nService).iniciar()),
    /*
     * Fechas en el idioma del usuario. Sin esto Angular usa `en-US` y los
     * `| date` escribían el mes en inglés dentro de una pantalla en español.
     */
    proveerLocaleAngular(),
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
    provideHttpClient(withInterceptors([authInterceptor, idiomaInterceptor, conexionInterceptor])),
  ],
};
