import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { SocialButtonsComponent } from '../social-buttons/social-buttons.component';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RsIconComponent, SocialButtonsComponent],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card">

        <div class="rs-auth__brand">
        <img src="/images/logo-doogking.jpg" alt="Doogking" style="height:120px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-3)" />
          <p>Crea tu cuenta gratis</p>
        </div>

        <form [formGroup]="formulario" (ngSubmit)="onSubmit()" class="rs-auth__form">
          <div class="rs-field">
            <label for="nombre" class="rs-lbl">Nombre completo</label>
            <input
              id="nombre"
              type="text"
              formControlName="nombre"
              class="rs-inp"
              [class.rs-inp--error]="formulario.get('nombre')?.invalid && formulario.get('nombre')?.touched"
              placeholder="Tu nombre" />
            @if (formulario.get('nombre')?.invalid && formulario.get('nombre')?.touched) {
              <span class="rs-field-err">Ingresa tu nombre (mínimo 2 caracteres)</span>
            }
          </div>

          <div class="rs-field">
            <label for="email" class="rs-lbl">Correo electrónico</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="rs-inp"
              [class.rs-inp--error]="formulario.get('email')?.invalid && formulario.get('email')?.touched"
              placeholder="tu@email.com" />
            @if (formulario.get('email')?.invalid && formulario.get('email')?.touched) {
              <span class="rs-field-err">Ingresa un email válido</span>
            }
          </div>

          <div class="rs-field">
            <label for="password" class="rs-lbl">Contraseña</label>
            <div style="position:relative">
              <input
                id="password"
                [type]="mostrarPassword() ? 'text' : 'password'"
                formControlName="password"
                class="rs-inp"
                [class.rs-inp--error]="formulario.get('password')?.invalid && formulario.get('password')?.touched"
                style="padding-right:var(--sp-10)"
                placeholder="Mínimo 8 caracteres" />
              <button
                type="button"
                (click)="mostrarPassword.set(!mostrarPassword())"
                style="position:absolute;right:var(--sp-3);top:50%;transform:translateY(-50%);display:flex;align-items:center;transition:color var(--d-1)"
                [style.color]="mostrarPassword() ? 'var(--c-accent)' : 'var(--t-400)'">
                <rs-icon [name]="mostrarPassword() ? 'eye-off' : 'eye'" [size]="16" [stroke]="2"></rs-icon>
              </button>
            </div>
            @if (formulario.get('password')?.invalid && formulario.get('password')?.touched) {
              <span class="rs-field-err">La contraseña debe tener al menos 8 caracteres</span>
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
            {{ cargando() ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>
        </form>

        <app-social-buttons />

        <p style="font-size:var(--f-xs);color:var(--t-400);text-align:center;margin-top:var(--sp-4);line-height:1.5">
          Al registrarte aceptas nuestros <a routerLink="/terminos" style="color:#7AA3FF">Términos</a>
          y <a routerLink="/privacidad" style="color:#7AA3FF">Política de privacidad</a>.
        </p>

        <div class="rs-auth__footer">
          ¿Ya tienes cuenta? <a routerLink="/auth/login">Inicia sesión</a>
        </div>
      </div>
    </div>
  `,
})
export class RegistroComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);

  readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async onSubmit(): Promise<void> {
    if (this.formulario.invalid) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      await this.authService.registro({
        nombre: this.formulario.value.nombre!,
        email: this.formulario.value.email!,
        password: this.formulario.value.password!,
      });
    } catch {
      this.error.set('Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
