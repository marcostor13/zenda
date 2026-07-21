import { Injectable } from '@angular/core';

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
   */
  async renderizarBotonGoogle(
    contenedor: HTMLElement,
    clientId: string,
    onToken: (idToken: string) => void,
  ): Promise<void> {
    await this.cargarGoogle();
    const google = (window as unknown as { google: GoogleId }).google;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp: { credential: string }) => onToken(resp.credential),
    });
    google.accounts.id.renderButton(contenedor, {
      theme: 'outline',
      size: 'large',
      width: contenedor.offsetWidth || 320,
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
    });
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
