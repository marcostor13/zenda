import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/** Las dos contraseñas tienen que coincidir; el error va en el grupo, no en un campo. */
function contrasenasCoinciden(grupo: AbstractControl): ValidationErrors | null {
  const nueva = grupo.get('nuevaPassword')?.value as string;
  const repetida = grupo.get('repetirPassword')?.value as string;
  return nueva && repetida && nueva !== repetida ? { noCoinciden: true } : null;
}

/**
 * Paso 2 de la recuperación: llega desde el enlace del correo
 * (`/auth/restablecer?token=…`). Al guardar, el API devuelve la sesión ya
 * iniciada y `restablecerPassword` redirige por rol: pedirle al usuario que
 * vuelva a escribir la contraseña que acaba de elegir no aporta nada.
 */
@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [
    TraducirPipe, ReactiveFormsModule, RouterLink, RsIconComponent
  ],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card">
        <div class="rs-auth__brand">
          <img src="/images/logo-doogking.jpg" alt="Doogking" style="height:96px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-3)" />
          <p>{{ 'Elige tu contraseña nueva' | t }}</p>
        </div>

        @if (sinToken()) {
          <div style="text-align:center">
            <div style="width:64px;height:64px;border-radius:50%;background:rgba(185,28,28,.1);color:#B91C1C;display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4)">
              <rs-icon name="x" [size]="30" [stroke]="2"></rs-icon>
            </div>
            <h2 style="font-size:var(--f-lg);font-weight:var(--w-7);color:var(--t-100);margin-bottom:var(--sp-2)">{{ 'Enlace no válido' | t }}</h2>
            <p style="color:var(--t-400);font-size:var(--f-sm);line-height:1.6">
              {{ 'Este enlace no es válido o ha caducado. Pide uno nuevo y vuelve a intentarlo.' | t }}
            </p>
            <a routerLink="/auth/recuperar" class="rs-btn rs-btn--primary rs-btn--block" style="margin-top:var(--sp-5)">
              {{ 'Pedir un enlace nuevo' | t }}
            </a>
          </div>
        } @else {
          <form [formGroup]="formulario" (ngSubmit)="onSubmit()" class="rs-auth__form">
            <div class="rs-field">
              <label for="nueva" class="rs-lbl">{{ 'Contraseña nueva' | t }}</label>
              <div style="position:relative">
                <input
                  id="nueva"
                  [type]="mostrar() ? 'text' : 'password'"
                  formControlName="nuevaPassword"
                  class="rs-inp"
                  style="padding-right:var(--sp-10)"
                  autocomplete="new-password"
                  [class.rs-inp--error]="formulario.get('nuevaPassword')?.invalid && formulario.get('nuevaPassword')?.touched"
                  [placeholder]="'Mínimo 8 caracteres' | t" />
                <button
                  type="button"
                  (click)="mostrar.set(!mostrar())"
                  style="position:absolute;right:var(--sp-2);top:50%;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;width:40px;height:40px"
                  [style.color]="mostrar() ? 'var(--c-accent)' : 'var(--t-400)'">
                  <rs-icon [name]="mostrar() ? 'eye-off' : 'eye'" [size]="16" [stroke]="2"></rs-icon>
                </button>
              </div>
              @if (formulario.get('nuevaPassword')?.invalid && formulario.get('nuevaPassword')?.touched) {
                <span class="rs-field-err">{{ 'La contraseña debe tener al menos 8 caracteres' | t }}</span>
              }
            </div>

            <div class="rs-field">
              <label for="repetir" class="rs-lbl">{{ 'Repite la contraseña' | t }}</label>
              <input
                id="repetir"
                [type]="mostrar() ? 'text' : 'password'"
                formControlName="repetirPassword"
                class="rs-inp"
                autocomplete="new-password"
                [class.rs-inp--error]="formulario.hasError('noCoinciden') && formulario.get('repetirPassword')?.touched"
                placeholder="••••••••" />
              @if (formulario.hasError('noCoinciden') && formulario.get('repetirPassword')?.touched) {
                <span class="rs-field-err">{{ 'Las contraseñas no coinciden' | t }}</span>
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
              {{ cargando() ? 'Guardando…' : 'Guardar y entrar' }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class RestablecerPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly cargando = signal(false);
  readonly mostrar = signal(false);
  readonly sinToken = signal(false);
  readonly error = signal<string | null>(null);

  private token = '';

  readonly formulario = this.fb.nonNullable.group(
    {
      nuevaPassword: ['', [Validators.required, Validators.minLength(8)]],
      repetirPassword: ['', [Validators.required]],
    },
    { validators: contrasenasCoinciden },
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.sinToken.set(true);
  }

  async onSubmit(): Promise<void> {
    if (this.formulario.invalid || this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      // En éxito, restablecerPassword guarda la sesión y redirige por rol.
      await this.authService.restablecerPassword(
        this.token,
        this.formulario.getRawValue().nuevaPassword,
      );
    } catch {
      this.error.set('El enlace no es válido o ha caducado. Pide uno nuevo desde "¿Olvidaste tu contraseña?".');
    } finally {
      this.cargando.set(false);
    }
  }
}
