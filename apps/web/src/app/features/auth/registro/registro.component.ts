import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="registro-container">
      <h1>Crear cuenta</h1>

      <form [formGroup]="formulario" (ngSubmit)="onSubmit()">
        <div>
          <label for="nombre">Nombre completo</label>
          <input id="nombre" type="text" formControlName="nombre" />
        </div>

        <div>
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" />
        </div>

        <div>
          <label for="password">Contraseña</label>
          <input id="password" type="password" formControlName="password" />
        </div>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <button type="submit" [disabled]="formulario.invalid || cargando()">
          {{ cargando() ? 'Creando cuenta...' : 'Registrarme' }}
        </button>
      </form>

      <p>¿Ya tienes cuenta? <a routerLink="/auth/login">Inicia sesión</a></p>
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
