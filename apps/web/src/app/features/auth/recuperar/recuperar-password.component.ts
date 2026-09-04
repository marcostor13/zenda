import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/**
 * Paso 1 de la recuperación: pedir el enlace por correo.
 *
 * El mensaje de éxito es deliberadamente ambiguo ("si ese correo está
 * registrado…"). El API responde igual exista o no la cuenta, así que afinar
 * aquí el texto convertiría la pantalla en un buscador de usuarios.
 */
@Component({
  selector: 'app-recuperar-password',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule, RouterLink, RsIconComponent
  ],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card">
        <div class="rs-auth__brand">
          <img src="/images/logo-doogking.jpg" alt="Doogking" style="height:96px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-3)" />
          <p>{{ 'Recupera el acceso a tu cuenta' | t }}</p>
        </div>

        @if (enviado()) {
          <div style="text-align:center">
            <div style="width:64px;height:64px;border-radius:50%;background:rgba(22,163,74,.12);color:#16A34A;display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4)">
              <rs-icon name="check" [size]="30" [stroke]="2"></rs-icon>
            </div>
            <h2 style="font-size:var(--f-lg);font-weight:var(--w-7);color:var(--t-100);margin-bottom:var(--sp-2)">{{ 'Revisa tu correo' | t }}</h2>
            <p style="color:var(--t-400);font-size:var(--f-sm);line-height:1.6">
              {{ 'Si' | t }} <strong>{{ emailEnviado() }}</strong> {{ 'está registrado, te hemos enviado un enlace para elegir una contraseña nueva. Caduca en una hora.' | t }}
            </p>
            <a routerLink="/auth/login" class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-5)">
              {{ 'Volver a iniciar sesión' | t }}
            </a>
          </div>
        } @else {
          <form [formGroup]="formulario" (ngSubmit)="onSubmit()" class="rs-auth__form">
            <p style="color:var(--t-400);font-size:var(--f-sm);line-height:1.6;margin-bottom:var(--sp-2)">
              {{ 'Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.' | t }}
            </p>

            <div class="rs-field">
              <label for="email" class="rs-lbl">{{ 'Correo electrónico' | t }}</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                class="rs-inp"
                autocomplete="email"
                [class.rs-inp--error]="formulario.get('email')?.invalid && formulario.get('email')?.touched"
                placeholder="tu@email.com" inputmode="email" />
              @if (formulario.get('email')?.invalid && formulario.get('email')?.touched) {
                <span class="rs-field-err">{{ 'Ingresa un email válido' | t }}</span>
              }
            </div>

            @if (error()) {
              <div class="rs-alert rs-alert--error">{{ error() }}</div>
            }

            <button
              type="submit"
              class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
              [disabled]="formulario.invalid || cargando()">
              @if (cargando()) {
                <span class="rs-spin"></span>
              }
              {{ cargando() ? 'Enviando…' : 'Enviarme el enlace' }}
            </button>
          </form>

          <div class="rs-auth__footer">
            {{ '¿Te has acordado?' | t }} <a routerLink="/auth/login">{{ 'Inicia sesión' | t }}</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class RecuperarPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly cargando = signal(false);
  readonly enviado = signal(false);
  readonly emailEnviado = signal('');
  readonly error = signal<string | null>(null);

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit(): Promise<void> {
    if (this.formulario.invalid || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);
    const email = this.formulario.getRawValue().email;

    try {
      await this.authService.recuperarPassword(email);
      this.emailEnviado.set(email);
      this.enviado.set(true);
    } catch {
      // Un fallo aquí es de red o del servidor: nunca "ese email no existe".
      this.error.set('No hemos podido enviar el correo. Inténtalo de nuevo en unos minutos.');
    } finally {
      this.cargando.set(false);
    }
  }
}
