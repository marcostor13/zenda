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
          <div #googleBtn class="sb__google"></div>
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

  async ngAfterViewInit(): Promise<void> {
    const { googleClientId, facebookAppId } = await this.configSocial.cargar();
    this.appIdFacebook = facebookAppId;
    this.hayGoogle.set(!!googleClientId);
    this.hayFacebook.set(!!facebookAppId);

    // El contenedor del botón vive dentro de un `@if`: hasta que la vista no se
    // repinta con la configuración recién llegada, no existe en el DOM y no hay
    // dónde dibujarlo.
    this.cdr.detectChanges();

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
