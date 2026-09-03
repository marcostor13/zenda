import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import type { IdiomaSoportado } from 'shared';
import { I18nService } from '../i18n/i18n.service';

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
  private readonly i18n = inject(I18nService);
  private googleListo?: Promise<void>;
  private facebookListo?: Promise<void>;
  private nativoListo?: Promise<void>;

  /**
   * Dentro de la app hay que usar el SDK nativo, no el de la web.
   *
   * Google Identity Services no está soportado en un WebView: el botón que
   * dibuja `renderizarBotonGoogle` no completa el acceso en Android ni en iOS.
   * El plugin nativo abre el selector de cuentas del sistema, que además es lo
   * que el usuario espera de una app instalada.
   */
  get usaSdkNativo(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Acceso con Google en la app instalada. Devuelve el mismo ID token que el
   * flujo web, así que el API lo valida igual y no hay que tocar el backend.
   *
   * `webClientId` es el cliente **de tipo web**, también en Android: el cliente
   * de Android sirve para que Google compruebe la firma del APK (paquete +
   * SHA-1) y nunca aparece en el código. El token que se emite lleva como
   * `aud` el de web, que es el que el API ya tiene configurado.
   */
  async entrarConGoogleNativo(webClientId: string): Promise<string> {
    await this.iniciarNativo(webClientId);

    const { result } = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['profile', 'email'] },
    });

    const idToken = 'idToken' in result ? result.idToken : null;
    if (!idToken) {
      // Pasa si se configura el modo offline, que devuelve código de
      // autorización en vez de token. Sin token no hay nada que mandar al API.
      throw new Error('Google no devolvió el token de identidad');
    }
    return idToken;
  }

  /** `initialize` es idempotente pero la promesa se cachea: no repetir trabajo por login. */
  private iniciarNativo(webClientId: string): Promise<void> {
    this.nativoListo ??= SocialLogin.initialize({ google: { webClientId } });
    return this.nativoListo;
  }

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

  /**
   * El idioma del botón lo fija Google por el parámetro `hl` del script. Sin
   * él usa el del **navegador**, no el de la aplicación: con la interfaz en
   * español y el móvil en inglés salía un "Continue with Google" en medio de
   * una pantalla en español. Es el botón que se veía descolocado.
   *
   * Va en la URL y no en `renderButton` porque GIS lee el idioma al cargar el
   * script, y éste se descarga una sola vez.
   */
  private cargarGoogle(): Promise<void> {
    this.googleListo ??= this.inyectarScript(
      `https://accounts.google.com/gsi/client?hl=${encodeURIComponent(this.i18n.idioma())}`,
    );
    return this.googleListo;
  }

  /**
   * Meta escoge el idioma por la ruta del SDK (`/es_ES/sdk.js`). Estaba fijo en
   * español, así que un usuario en alemán o en polaco veía el diálogo de acceso
   * en español. Se construye desde el idioma activo.
   */
  private cargarFacebook(appId: string): Promise<void> {
    const locale = LOCALES_FACEBOOK[this.i18n.idioma()] ?? LOCALES_FACEBOOK['es'];
    this.facebookListo ??= this.inyectarScript(`https://connect.facebook.net/${locale}/sdk.js`).then(() => {
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

/**
 * Meta no acepta el código de idioma suelto: pide `idioma_PAÍS`. Se elige el
 * país más habitual de cada idioma en Europa; si algún día falta uno, se cae al
 * español, que es lo que había antes para todos.
 */
const LOCALES_FACEBOOK: Record<IdiomaSoportado, string> = {
  es: 'es_ES',
  en: 'en_GB',
  de: 'de_DE',
  fr: 'fr_FR',
  it: 'it_IT',
  pt: 'pt_PT',
  pl: 'pl_PL',
  nl: 'nl_NL',
};
