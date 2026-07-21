import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';

/**
 * Procesa el enlace de verificación (`/auth/verificar?token=…`): confirma el
 * email en el backend y, si es válido, arranca la sesión y redirige por rol.
 */
@Component({
  selector: 'app-verificar-email',
  standalone: true,
  imports: [RouterLink, RsIconComponent],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card" style="text-align:center">
        <div class="rs-auth__brand">
          <img src="/images/logo-doogking.jpg" alt="Doogking" style="height:96px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-3)" />
        </div>

        @if (estado() === 'verificando') {
          <span class="rs-spin" style="margin:var(--sp-6) auto"></span>
          <p style="color:var(--t-300)">Verificando tu correo…</p>
        } @else if (estado() === 'error') {
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(185,28,28,.1);color:#B91C1C;display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4)">
            <rs-icon name="x" [size]="30" [stroke]="2"></rs-icon>
          </div>
          <h2 style="font-size:var(--f-lg);font-weight:var(--w-7);color:var(--t-100);margin-bottom:var(--sp-2)">Enlace no válido</h2>
          <p style="color:var(--t-400);font-size:var(--f-sm);line-height:1.6">
            El enlace de verificación no es válido o ha caducado. Inicia sesión para recibir uno nuevo.
          </p>
          <a routerLink="/auth/login" class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-5)">
            Ir a iniciar sesión
          </a>
        }
      </div>
    </div>
  `,
})
export class VerificarEmailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  readonly estado = signal<'verificando' | 'error'>('verificando');

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.estado.set('error');
      return;
    }
    try {
      // En éxito, verificarEmail guarda la sesión y redirige por rol.
      await this.authService.verificarEmail(token);
    } catch {
      this.estado.set('error');
    }
  }
}
