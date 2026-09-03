import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushRegistroService } from './push-registro.service';

/**
 * Integración con el envoltorio nativo (Android/iOS).
 *
 * Todo lo que hay aquí **sólo se ejecuta dentro de la app**: en el navegador
 * `Capacitor.isNativePlatform()` es false y el servicio no toca nada. Así el
 * mismo código sirve para la web y para el móvil sin ramas por todas partes.
 */
@Injectable({ providedIn: 'root' })
export class MovilService {
  private readonly router = inject(Router);
  private readonly pushRegistro = inject(PushRegistroService);

  get esNativo(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Se llama una vez al arrancar la aplicación. Nunca lanza. */
  async iniciar(): Promise<void> {
    if (!this.esNativo) return;

    this.marcarDocumentoComoNativo();

    await Promise.allSettled([
      this.ocultarSplash(),
      this.configurarBarraEstado(),
      this.escucharBotonAtras(),
      this.escucharEnlacesProfundos(),
      this.pushRegistro.iniciar(),
    ]);
  }

  /**
   * Marca el documento como "dentro de la app". El CSS lo usa para apagar los
   * comportamientos de navegador que delatan que esto es una web metida en un
   * WebView (rebote del scroll, destello azul al tocar, selección de texto al
   * mantener pulsado) y para enseñar la barra inferior de navegación.
   *
   * Se hace con una clase y no con `esNativo` en cada plantilla para que la web
   * no pague nada: sin la clase, ninguna de esas reglas existe.
   */
  private marcarDocumentoComoNativo(): void {
    const raiz = document.documentElement;
    raiz.classList.add('dk-nativo');
    raiz.classList.add(`dk-${Capacitor.getPlatform()}`);
  }

  /**
   * La splash se oculta desde aquí y no sola (`launchAutoHide: false`): si se
   * fuera por tiempo, entre que desaparece y Angular pinta la primera vista se
   * vería un destello en blanco.
   */
  private async ocultarSplash(): Promise<void> {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  }

  private async configurarBarraEstado(): Promise<void> {
    /*
     * Iconos oscuros. `Style.Light` significa "texto oscuro para fondo claro",
     * que es lo que toca: la navbar es blanca translúcida (`.rs-navbar`), no
     * azul. Estaba puesto `Style.Dark` —texto claro— y el resultado era un
     * reloj blanco sobre una barra blanca: la hora y la batería no se veían.
     */
    await StatusBar.setStyle({ style: Style.Light });

    if (Capacitor.getPlatform() === 'android') {
      /*
       * Color de la barra de estado en Android 14 y anteriores, donde el
       * sistema la pinta como una franja aparte. Se iguala al fondo de la
       * navbar para que se lea como una sola pieza.
       *
       * Desde Android 15 (API 35) esto no hace nada: el sistema obliga a
       * dibujar de borde a borde y la barra es transparente. Ahí quien cubre
       * esa zona es el relleno superior de `.rs-navbar`, no esta llamada.
       */
      await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
    }
  }

  /**
   * Botón físico de atrás en Android.
   *
   * Sin esto, el botón cierra la app desde cualquier pantalla — incluso a mitad
   * de una reserva. Lo esperable es que retroceda por el historial y sólo
   * cierre cuando ya no hay a dónde volver.
   */
  private async escucharBotonAtras(): Promise<void> {
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      void App.exitApp();
    });
  }

  /**
   * Enlaces profundos: un enlace a doogking.com abre la pantalla equivalente
   * dentro de la app. Se navega por el `Router`, no cambiando `location`, para
   * no recargar el WebView entero y perder la sesión en memoria.
   */
  private async escucharEnlacesProfundos(): Promise<void> {
    await App.addListener('appUrlOpen', ({ url }) => {
      const ruta = rutaDeUrl(url);
      if (ruta) void this.router.navigateByUrl(ruta);
    });
  }
}

/**
 * Extrae la ruta interna de una URL de la marca. Devuelve null si la URL es de
 * otro dominio: navegar a lo que llegue por un intent sería dejar que cualquier
 * app decida qué pantalla abrimos.
 */
export const rutaDeUrl = (url: string): string | null => {
  try {
    const { hostname, pathname, search } = new URL(url);
    const propio = hostname === 'doogking.com' || hostname === 'www.doogking.com';
    if (!propio) return null;
    return `${pathname}${search}` || '/';
  } catch {
    return null;
  }
};
