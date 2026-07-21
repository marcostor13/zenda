import {
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { SocialSdkService } from '../../../core/auth/social-sdk.service';
import { environment } from '../../../../environments/environment';

/**
 * Botones de acceso con Google y Meta. Se muestran solo si hay credenciales
 * configuradas en el environment; si no, el bloque queda oculto y la app sigue
 * funcionando con email/contraseña.
 */
@Component({
  selector: 'app-social-buttons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hayGoogle() || hayFacebook()) {
      <div class="sb">
        <div class="sb__divider"><span>o continúa con</span></div>

        @if (hayGoogle()) {
          <div #googleBtn class="sb__google"></div>
        }

        @if (hayFacebook()) {
          <button type="button" class="sb__fb" (click)="entrarConFacebook()" [disabled]="cargando()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/>
            </svg>
            Continuar con Meta
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

  private readonly googleBtn = viewChild<ElementRef<HTMLElement>>('googleBtn');

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly hayGoogle = signal(!!environment.googleClientId);
  readonly hayFacebook = signal(!!environment.facebookAppId);

  async ngAfterViewInit(): Promise<void> {
    const contenedor = this.googleBtn()?.nativeElement;
    if (!contenedor || !this.hayGoogle()) return;
    try {
      await this.sdk.renderizarBotonGoogle(contenedor, environment.googleClientId, (idToken) =>
        this.entrarConGoogle(idToken),
      );
    } catch {
      this.error.set('No se pudo cargar el acceso con Google.');
    }
  }

  private async entrarConGoogle(idToken: string): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.authService.loginConGoogle(idToken);
    } catch {
      this.error.set('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async entrarConFacebook(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const accessToken = await this.sdk.loginFacebook(environment.facebookAppId);
      await this.authService.loginConFacebook(accessToken);
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      this.error.set(msg.includes('cancelado') ? null : 'No se pudo iniciar sesión con Meta. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
