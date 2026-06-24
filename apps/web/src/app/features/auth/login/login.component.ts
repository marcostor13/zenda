import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="login-container">
      <h1>Iniciar sesión</h1>

      <form [formGroup]="formulario" (ngSubmit)="onSubmit()">
        <div>
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" />
          @if (formulario.get('email')?.invalid && formulario.get('email')?.touched) {
            <span class="error">Email inválido</span>
          }
        </div>

        <div>
          <label for="password">Contraseña</label>
          <input id="password" type="password" formControlName="password" />
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <button type="submit" [disabled]="formulario.invalid || cargando()">
          {{ cargando() ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>

      <p>¿No tienes cuenta? <a routerLink="/auth/registro">Regístrate</a></p>
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
