import { Injectable } from '@angular/core';

/**
 * Google sólo acepta anchos entre 200 y 400 px; fuera de ese rango ignora el
 * valor y dibuja el botón al tamaño que le parece, que es justo lo que lo hacía
 * desbordar en pantallas estrechas. Por debajo de 200 el CSS de `.sb__google`
 * lo encaja con `max-width`, porque el mínimo de Google no se puede bajar.
 */
const GOOGLE_ANCHO_MIN = 200;
const GOOGLE_ANCHO_MAX = 400;

function anchoValidoGoogle(disponible: number): number {
  if (!disponible) return GOOGLE_ANCHO_MIN;
  return Math.min(GOOGLE_ANCHO_MAX, Math.max(GOOGLE_ANCHO_MIN, Math.round(disponible)));
}

/**
 * Carga perezosa de los SDKs de Google Identity Services y Meta (Facebook) y
 * expone su flujo de acceso. Los scripts se inyectan una sola vez y solo cuando
 * hay credenciales configuradas, para no penalizar el arranque de la app.
 */
@Injectable({ providedIn: 'root' })
export class SocialSdkService {
  private googleListo?: Promise<void>;
  private facebookListo?: Promise<void>;

  /**
   * Renderiza el botón oficial de Google en el contenedor dado. Google invoca
   * `onToken` con el ID token (credential) cuando el usuario completa el acceso.
   *
   * Devuelve una función para volver a dibujarlo: `renderButton` escribe un
   * **ancho fijo en píxeles** dentro del marcado que inyecta
   * (`<div style="width: 271px">`) y no lo recalcula nunca. Si el contenedor se
   * estrecha después —girar el móvil, redimensionar la ventana, abrir el
   * teclado— el botón conserva el ancho viejo y se sale de la tarjeta. Quien lo
   * monta debe llamarla cuando cambie el ancho disponible.
   */
  async renderizarBotonGoogle(
    contenedor: HTMLElement,
    clientId: string,
    onToken: (idToken: string) => void,
  ): Promise<() => void> {
    await this.cargarGoogle();
    const google = (window as unknown as { google: GoogleId }).google;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: { credential: string }) => onToken(resp.credential),
    });

    const dibujar = (): void => {
      // `renderButton` acumula si el contenedor ya tiene un botón dentro.
      contenedor.replaceChildren();
      google.accounts.id.renderButton(contenedor, {
        theme: 'outline',
        size: 'large',
        width: anchoValidoGoogle(contenedor.clientWidth),
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'center',
      });
    };

    dibujar();
    return dibujar;
  }

  /** Abre el diálogo de Meta y resuelve con el access token (o lanza si se cancela). */
  async loginFacebook(appId: string): Promise<string> {
    await this.cargarFacebook(appId);
    const FB = (window as unknown as { FB: FacebookSdk }).FB;
    return new Promise<string>((resolve, reject) => {
      FB.login(
        (respuesta) => {
          const token = respuesta.authResponse?.accessToken;
          if (token) resolve(token);
          else reject(new Error('Acceso con Meta cancelado'));
        },
        { scope: 'public_profile,email' },
      );
    });
  }

  private cargarGoogle(): Promise<void> {
    this.googleListo ??= this.inyectarScript('https://accounts.google.com/gsi/client');
    return this.googleListo;
  }

  private cargarFacebook(appId: string): Promise<void> {
    this.facebookListo ??= this.inyectarScript('https://connect.facebook.net/es_ES/sdk.js').then(() => {
      (window as unknown as { FB: FacebookSdk }).FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
    });
    return this.facebookListo;
  }

  private inyectarScript(src: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });
  }
}

interface GoogleId {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, opciones: Record<string, unknown>) => void;
    };
  };
}

interface FacebookSdk {
  init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (
    cb: (respuesta: { authResponse?: { accessToken?: string } }) => void,
    opciones: { scope: string },
  ) => void;
}
