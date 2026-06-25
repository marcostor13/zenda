import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="rs-auth-layout">
      <div class="rs-auth-card">

        <div class="rs-auth-card__brand">
          <h1>Zenda</h1>
          <p>Bienvenido de vuelta</p>
        </div>

        <form [formGroup]="formulario" (ngSubmit)="onSubmit()">
          <div class="rs-form-group">
            <label for="email" class="rs-label">Correo electrónico</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="rs-input"
              [class.rs-input--error]="formulario.get('email')?.invalid && formulario.get('email')?.touched"
              placeholder="tu@email.com" />
            @if (formulario.get('email')?.invalid && formulario.get('email')?.touched) {
              <span class="rs-field-error">Ingresa un email válido</span>
            }
          </div>

          <div class="rs-form-group">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <label for="password" class="rs-label">Contraseña</label>
              <a routerLink="/auth/recuperar" style="font-size:var(--text-xs);color:var(--accent-light)">¿Olvidaste tu contraseña?</a>
            </div>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="rs-input"
              placeholder="••••••••" />
          </div>

          @if (error()) {
            <div class="rs-alert rs-alert--error">{{ error() }}</div>
          }

          <button
            type="submit"
            class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
            style="margin-top:var(--s-2)"
            [disabled]="formulario.invalid || cargando()">
            @if (cargando()) {
              <span class="rs-spinner"></span>
            }
            {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>

        <div class="rs-divider rs-divider--text" style="margin-block:var(--s-6)">o</div>

        <div class="rs-auth-card__footer">
          ¿No tienes cuenta? <a routerLink="/auth/registro">Regístrate gratis</a>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly formulario = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit(): Promise<void> {
    if (this.formulario.invalid) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      await this.authService.login({
        email: this.formulario.value.email!,
        password: this.formulario.value.password!,
      });
    } catch {
      this.error.set('Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
