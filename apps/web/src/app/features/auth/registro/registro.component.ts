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
          <p>{{ pendiente() ? 'Verifica tu correo' : 'Crea tu cuenta gratis' }}</p>
        </div>

        @if (pendiente()) {
          <div style="text-align:center">
            <div style="width:64px;height:64px;border-radius:50%;background:var(--c-accent-lo);color:var(--c-accent);display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4)">
              <rs-icon name="mail" [size]="30" [stroke]="1.75"></rs-icon>
            </div>
            <p style="color:var(--t-200);font-size:var(--f-base);line-height:1.6">
              Te enviamos un enlace de verificación a<br><strong>{{ emailRegistrado() }}</strong>.
            </p>
            <p style="color:var(--t-400);font-size:var(--f-sm);margin-top:var(--sp-3)">
              Ábrelo para activar tu cuenta y continuar. Revisa también la carpeta de spam.
            </p>
            @if (reenviado()) {
              <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">Correo reenviado ✓</div>
            }
            <button type="button" class="rs-btn rs-btn--outline rs-btn--block" style="margin-top:var(--sp-5)"
                    (click)="reenviar()" [disabled]="reenviando()">
              {{ reenviando() ? 'Reenviando…' : 'Reenviar correo' }}
            </button>
            <div class="rs-auth__footer" style="margin-top:var(--sp-4)">
              <a routerLink="/auth/login">Volver a iniciar sesión</a>
            </div>
          </div>
        } @else {

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
        <div class="rs-auth__footer" style="margin-top:var(--sp-2)">
          ¿Tienes un negocio? <a routerLink="/auth/registro-comercio">Regístralo en Doogking</a>
        </div>
        }
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
  readonly pendiente = signal(false);
  readonly emailRegistrado = signal('');
  readonly reenviando = signal(false);
  readonly reenviado = signal(false);

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
      const respuesta = await this.authService.registro({
        nombre: this.formulario.value.nombre!,
        email: this.formulario.value.email!,
        password: this.formulario.value.password!,
      });
      this.emailRegistrado.set(respuesta.email);
      this.pendiente.set(true);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      this.error.set(status === 409 ? 'Ese email ya está registrado.' : 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  async reenviar(): Promise<void> {
    this.reenviando.set(true);
    this.reenviado.set(false);
    try {
      await this.authService.reenviarVerificacion(this.emailRegistrado());
      this.reenviado.set(true);
    } catch {
      this.error.set('No se pudo reenviar el correo.');
    } finally {
      this.reenviando.set(false);
    }
  }
}
