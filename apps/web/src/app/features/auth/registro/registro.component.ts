import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="rs-auth-layout">
      <div class="rs-auth-card">

        <div class="rs-auth-card__brand">
          <h1>Zenda</h1>
          <p>Crea tu cuenta gratis</p>
        </div>

        <form [formGroup]="formulario" (ngSubmit)="onSubmit()">
          <div class="rs-form-group">
            <label for="nombre" class="rs-label">Nombre completo</label>
            <input
              id="nombre"
              type="text"
              formControlName="nombre"
              class="rs-input"
              [class.rs-input--error]="formulario.get('nombre')?.invalid && formulario.get('nombre')?.touched"
              placeholder="Tu nombre" />
            @if (formulario.get('nombre')?.invalid && formulario.get('nombre')?.touched) {
              <span class="rs-field-error">Ingresa tu nombre (mínimo 2 caracteres)</span>
            }
          </div>

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
            <label for="password" class="rs-label">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="rs-input"
              [class.rs-input--error]="formulario.get('password')?.invalid && formulario.get('password')?.touched"
              placeholder="Mínimo 8 caracteres" />
            @if (formulario.get('password')?.invalid && formulario.get('password')?.touched) {
              <span class="rs-field-error">La contraseña debe tener al menos 8 caracteres</span>
            }
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
            {{ cargando() ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>
        </form>

        <p style="font-size:var(--text-xs);color:var(--text-muted);text-align:center;margin-top:var(--s-4);line-height:1.5">
          Al registrarte aceptas nuestros <a routerLink="/terminos" style="color:var(--accent-light)">Términos</a>
          y <a routerLink="/privacidad" style="color:var(--accent-light)">Política de privacidad</a>.
        </p>

        <div class="rs-auth-card__footer" style="margin-top:var(--s-4)">
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
