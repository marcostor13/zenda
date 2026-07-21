import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RsIconComponent],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card">

        <div class="rs-auth__brand">
          <img src="/images/logo-doogking.jpg" alt="Doogking" style="height:120px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-3)" />
          <p>Bienvenido de vuelta</p>
        </div>

        <form [formGroup]="formulario" (ngSubmit)="onSubmit()" class="rs-auth__form">
          <div class="rs-field">
            <label for="email" class="rs-lbl">Correo electrónico</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="rs-inp"
              autocomplete="email"
              [attr.autofocus]="emailRecordado() ? null : ''"
              [class.rs-inp--error]="formulario.get('email')?.invalid && formulario.get('email')?.touched"
              placeholder="tu@email.com" />
            @if (formulario.get('email')?.invalid && formulario.get('email')?.touched) {
              <span class="rs-field-err">Ingresa un email válido</span>
            }
          </div>

          <div class="rs-field">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <label for="password" class="rs-lbl">Contraseña</label>
              <a routerLink="/auth/recuperar" style="font-size:var(--f-xs);color:#7AA3FF">¿Olvidaste tu contraseña?</a>
            </div>
            <div style="position:relative">
              <input
                id="password"
                [type]="mostrarPassword() ? 'text' : 'password'"
                formControlName="password"
                class="rs-inp"
                style="padding-right:var(--sp-10)"
                placeholder="••••••••" />
              <button
                type="button"
                (click)="mostrarPassword.set(!mostrarPassword())"
                style="position:absolute;right:var(--sp-3);top:50%;transform:translateY(-50%);color:var(--t-400);display:flex;align-items:center;transition:color var(--d-1)"
                [style.color]="mostrarPassword() ? 'var(--c-accent)' : 'var(--t-400)'">
                <rs-icon [name]="mostrarPassword() ? 'eye-off' : 'eye'" [size]="16" [stroke]="2"></rs-icon>
              </button>
            </div>
          </div>

          <label style="display:flex;align-items:center;gap:var(--sp-2);font-size:var(--f-sm);color:var(--t-300);cursor:pointer;user-select:none">
            <input type="checkbox" formControlName="recordar"
                   style="accent-color:var(--c-accent);width:16px;height:16px" />
            Recordar mi correo
          </label>

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
            {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>

        <div class="rs-auth__divider">o</div>

        <div class="rs-auth__footer">
          ¿No tienes cuenta? <a routerLink="/auth/registro">Regístrate gratis</a>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  private static readonly EMAIL_KEY = 'dk_login_email';

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);

  private readonly emailGuardado = localStorage.getItem(LoginComponent.EMAIL_KEY);
  readonly emailRecordado = signal(!!this.emailGuardado);

  readonly formulario = this.fb.group({
    email: [this.emailGuardado ?? '', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    recordar: [!!this.emailGuardado],
  });

  async onSubmit(): Promise<void> {
    if (this.formulario.invalid) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      const email = this.formulario.value.email!;
      await this.authService.login({ email, password: this.formulario.value.password! });
      if (this.formulario.value.recordar) {
        localStorage.setItem(LoginComponent.EMAIL_KEY, email);
      } else {
        localStorage.removeItem(LoginComponent.EMAIL_KEY);
      }
    } catch {
      this.error.set('Credenciales incorrectas. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
