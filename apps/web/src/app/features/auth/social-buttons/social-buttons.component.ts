import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { mensajeDeError } from '../../../shared/mensaje-error';
import { SocialSdkService } from '../../../core/auth/social-sdk.service';
import { SocialConfigService } from '../../../core/auth/social-config.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/** Cambio de ancho a partir del cual merece la pena repintar el botón de Google. */
const UMBRAL_REDIBUJADO = 8;

/**
 * Botones de acceso con Google y Meta. Se muestran solo si el API devuelve
 * credenciales configuradas; si no, el bloque queda oculto y la app sigue
 * funcionando con email/contraseña.
 */
@Component({
  selector: 'app-social-buttons',
  standalone: true,
  imports: [TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hayGoogle() || hayFacebook()) {
      <div class="sb">
        <div class="sb__divider"><span>{{ 'o continúa con' | t }}</span></div>

        @if (hayGoogle()) {
          @if (esNativo) {
            <!--
              En la app se pinta un botón nuestro: el de Google Identity
              Services no funciona dentro de un WebView. Sigue las pautas de
              marca de Google (logo a color sobre fondo blanco y borde).
            -->
            <button type="button" class="sb__google-nativo" (click)="entrarConGoogleNativo()" [disabled]="cargando()">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {{ 'Continuar con Google' | t }}
            </button>
          } @else {
            <div #googleBtn class="sb__google"></div>
          }
        }

        @if (hayFacebook()) {
          <button type="button" class="sb__fb" (click)="entrarConFacebook()" [disabled]="cargando()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/>
            </svg>
            {{ 'Continuar con Meta' | t }}
          </button>
        }

        @if (error()) { <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-3)">{{ error() }}</div> }
      </div>
    }
  `,
  styles: [`
    .sb { margin-top: var(--sp-4); }
    .sb__divider { display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-4); color:var(--t-400); font-size:var(--f-xs); }
    .sb__divider::before, .sb__divider::after { content:''; flex:1; height:1px; background:var(--b-1); }
    .sb__google { display:flex; justify-content:center; min-height:44px; margin-bottom:var(--sp-3); }
    .sb__google-nativo {
      display:flex; align-items:center; justify-content:center; gap:var(--sp-3);
      width:100%; min-height:44px; margin-bottom:var(--sp-3);
      padding:var(--sp-3) var(--sp-4);
      background:var(--c-card); color:var(--t-100);
      border:1px solid var(--b-2); border-radius:var(--r-full);
      font-size:var(--f-sm); font-weight:var(--w-6);
      &:disabled { opacity:.6; cursor:not-allowed; }
    }
    /*
     * Google inyecta su boton con un ancho fijo en linea y su minimo es 200px.
     * En una tarjeta mas estrecha que eso no hay forma de pedirle menos, y aqui
     * max-width lo encaja: como propiedad distinta, acota al width en linea.
     *
     * Va con ::ng-deep porque ese marcado lo crea el SDK de Google despues del
     * render y no lleva el atributo de encapsulacion del componente, asi que una
     * regla normal no llega a el (mismo caso que los pines de rs-mapa).
     */
    .sb__google ::ng-deep > div,
    .sb__google ::ng-deep div { max-width:100%; }
    .sb__fb {
      width:100%; display:flex; align-items:center; justify-content:center; gap:var(--sp-2);
      height:44px; border-radius:var(--r-full); border:1px solid var(--b-1);
      background:#1877F2; color:#fff; font-size:var(--f-sm); font-weight:var(--w-6); cursor:pointer;
      transition:opacity var(--d-2);
    }
    .sb__fb:hover { opacity:.92; }
    .sb__fb:disabled { opacity:.6; cursor:default; }
  `],
})
export class SocialButtonsComponent implements AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly sdk = inject(SocialSdkService);
  private readonly configSocial = inject(SocialConfigService);

  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly googleBtn = viewChild<ElementRef<HTMLElement>>('googleBtn');

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  /*
   * Arrancan apagados y los enciende la configuración que manda el API. Antes
   * salían de `environment`, y un client ID distinto al que valida el API
   * dibujaba un botón que sólo servía para acabar en un 401.
   */
  readonly hayGoogle = signal(false);
  readonly hayFacebook = signal(false);
  private appIdFacebook = '';
  private clientIdGoogle = '';

  /** Fijo durante toda la vida del componente: la plataforma no cambia. */
  protected readonly esNativo = this.sdk.usaSdkNativo;

  async ngAfterViewInit(): Promise<void> {
    const { googleClientId, facebookAppId } = await this.configSocial.cargar();
    this.appIdFacebook = facebookAppId;
    this.clientIdGoogle = googleClientId;
    this.hayGoogle.set(!!googleClientId);
    this.hayFacebook.set(!!facebookAppId);

    // El contenedor del botón vive dentro de un `@if`: hasta que la vista no se
    // repinta con la configuración recién llegada, no existe en el DOM y no hay
    // dónde dibujarlo.
    this.cdr.detectChanges();

    // En la app no hay contenedor que rellenar: el botón es nuestro y el flujo
    // lo dispara `entrarConGoogleNativo()`.
    if (this.esNativo) return;

    const contenedor = this.googleBtn()?.nativeElement;
    if (!contenedor || !googleClientId) return;
    try {
      const dibujar = await this.sdk.renderizarBotonGoogle(
        contenedor,
        googleClientId,
        (idToken) => this.entrarConGoogle(idToken),
      );
      this.seguirElAncho(contenedor, dibujar);
    } catch {
      this.error.set('No se pudo cargar el acceso con Google.');
    }
  }

  /**
   * Google fija el ancho del botón en píxeles al dibujarlo y no lo recalcula.
   * Al girar el móvil o redimensionar la ventana se quedaba con el ancho viejo
   * y se salía de la tarjeta, así que se vuelve a dibujar cuando el contenedor
   * cambia de tamaño.
   *
   * Se ignoran las variaciones de menos de `UMBRAL_REDIBUJADO` px: redibujar
   * dentro del propio observador vuelve a dispararlo, y sin margen el par
   * entraría en bucle.
   */
  private seguirElAncho(contenedor: HTMLElement, dibujar: () => void): void {
    if (typeof ResizeObserver === 'undefined') return;

    let ultimoAncho = contenedor.clientWidth;
    const observador = new ResizeObserver(() => {
      const ancho = contenedor.clientWidth;
      if (Math.abs(ancho - ultimoAncho) < UMBRAL_REDIBUJADO) return;
      ultimoAncho = ancho;
      dibujar();
    });

    observador.observe(contenedor);
    this.destroyRef.onDestroy(() => observador.disconnect());
  }

  /**
   * Acceso con Google desde la app.
   *
   * Los dos pasos se capturan por separado a propósito: que el sistema no
   * devuelva un token y que el API rechace el que sí devolvió son problemas
   * distintos, con arreglos distintos, y mezclarlos en un solo `catch` dejaba
   * ambos bajo el mismo "inténtalo de nuevo" que no dice nada.
   */
  async entrarConGoogleNativo(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    let idToken: string;
    try {
      idToken = await this.sdk.entrarConGoogleNativo(this.clientIdGoogle);
    } catch (error) {
      // Fallo del lado nativo: no es un error HTTP, así que `mensajeDeError` no
      // sabe leerlo y devolvería el texto por defecto, tirando la causa.
      const mensaje = (error as Error)?.message ?? '';
      this.error.set(esCancelacion(mensaje) ? null : describirFalloGoogle(mensaje, this.clientIdGoogle));
      this.cargando.set(false);
      return;
    }

    try {
      await this.authService.loginConGoogle(idToken);
    } catch (error) {
      // Aquí sí es un error del API, y su cuerpo explica el motivo (por ejemplo
      // que el `aud` del token no es el cliente configurado en el servidor).
      this.error.set(mensajeDeError(error, 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'));
    } finally {
      this.cargando.set(false);
    }
  }

  private async entrarConGoogle(idToken: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.authService.loginConGoogle(idToken);
    } catch (error) {
      // El API distingue el email sin verificar de una mala configuración del
      // cliente de Google; con el texto genérico las dos parecían lo mismo.
      this.error.set(mensajeDeError(error, 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async entrarConFacebook(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const accessToken = await this.sdk.loginFacebook(this.appIdFacebook);
      await this.authService.loginConFacebook(accessToken);
    } catch (error) {
      const msg = (error as Error)?.message ?? '';
      this.error.set(
        msg.includes('cancelado')
          ? null
          : mensajeDeError(error, 'No se pudo iniciar sesión con Meta. Inténtalo de nuevo.'),
      );
    } finally {
      this.cargando.set(false);
    }
  }
}

/**
 * Cerrar el selector de cuentas no es un error que haya que enseñar. Cada
 * plataforma lo dice a su manera y el plugin no normaliza el mensaje.
 */
const esCancelacion = (mensaje: string): boolean =>
  /cancel|cerrado|closed|dismiss|12501/i.test(mensaje);

/**
 * Traduce el fallo del SDK nativo a algo accionable.
 *
 * En la app no hay consola donde mirar: sin esto, cualquier problema de
 * configuración se veía como "inténtalo de nuevo" y la única forma de saber
 * qué pasaba era conectar el móvil por cable. Mismo criterio que el aviso de
 * "no se puede conectar con el servidor", que enseña la URL a la que llamaba.
 *
 * Se incluye el final del client ID porque el error más común de esta
 * integración es pasar el cliente equivocado —el de Android en lugar del de
 * web— y con los últimos caracteres se distingue de un vistazo.
 */
const describirFalloGoogle = (mensaje: string, clientId: string): string => {
  const cliente = clientId ? `…${clientId.slice(-30)}` : '(ninguno)';

  if (!clientId) {
    return 'El servidor no ha enviado el identificador de Google (GOOGLE_CLIENT_ID). '
      + 'Sin él la app no puede abrir el acceso.';
  }

  // Credential Manager: la firma del APK no cuadra con ningún cliente OAuth de
  // tipo Android en Google Cloud, o el cliente usado no es el de tipo web.
  if (/28444|10:|DEVELOPER_ERROR|not set up correctly/i.test(mensaje)) {
    return `Google no reconoce esta versión de la app. Suele ser que falta el cliente `
      + `OAuth de Android para la huella con la que está firmada, o que el identificador `
      + `usado no es el de tipo web. Cliente en uso: ${cliente}. Detalle: ${mensaje}`;
  }

  // Credential Manager necesita una cuenta de Google en el propio dispositivo.
  if (/no credentials|NoCredential|16:|account/i.test(mensaje)) {
    return 'No hay ninguna cuenta de Google añadida en este dispositivo. '
      + `Añádela en los ajustes del sistema y vuelve a intentarlo. Detalle: ${mensaje}`;
  }

  return `No se pudo iniciar sesión con Google. Cliente en uso: ${cliente}. Detalle: ${mensaje}`;
};
