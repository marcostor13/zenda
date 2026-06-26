import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { environment } from '../../../environments/environment';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const nueva = group.get('nuevaPassword')?.value;
  const confirmar = group.get('confirmarPassword')?.value;
  return nueva && confirmar && nueva !== confirmar ? { noCoinciden: true } : null;
}

@Component({
  selector: 'app-perfil-seguridad',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsNavbarComponent, RsIconComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      Volver al perfil
    </a>

    <div class="page-header">
      <h1>Seguridad</h1>
      <p>Cambia tu contraseña para mantener tu cuenta segura.</p>
    </div>

    <div class="rs-card form-card">

      <div class="security-icon">
        <rs-icon name="lock" [size]="24" [stroke]="1.5"></rs-icon>
      </div>

      <form [formGroup]="form" (ngSubmit)="cambiarPassword()">

        <div class="rs-field">
          <label class="rs-lbl">Contraseña actual *</label>
          <div class="input-wrap">
            <input
              class="rs-inp"
              [type]="verActual() ? 'text' : 'password'"
              formControlName="passwordActual"
              placeholder="Tu contraseña actual"
              [class.rs-inp--error]="hasErr('passwordActual')">
            <button type="button" class="toggle-vis" (click)="verActual.set(!verActual())">
              <rs-icon [name]="verActual() ? 'eye-off' : 'eye'" [size]="16" [stroke]="1.75"></rs-icon>
            </button>
          </div>
          @if (hasErr('passwordActual')) {
            <span class="rs-field-err">Introduce tu contraseña actual.</span>
          }
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Nueva contraseña *</label>
          <div class="input-wrap">
            <input
              class="rs-inp"
              [type]="verNueva() ? 'text' : 'password'"
              formControlName="nuevaPassword"
              placeholder="Mínimo 8 caracteres"
              [class.rs-inp--error]="hasErr('nuevaPassword')">
            <button type="button" class="toggle-vis" (click)="verNueva.set(!verNueva())">
              <rs-icon [name]="verNueva() ? 'eye-off' : 'eye'" [size]="16" [stroke]="1.75"></rs-icon>
            </button>
          </div>
          @if (hasErr('nuevaPassword')) {
            <span class="rs-field-err">La nueva contraseña debe tener al menos 8 caracteres.</span>
          }
        </div>

        <div class="rs-field">
          <label class="rs-lbl">Confirmar nueva contraseña *</label>
          <div class="input-wrap">
            <input
              class="rs-inp"
              [type]="verConfirmar() ? 'text' : 'password'"
              formControlName="confirmarPassword"
              placeholder="Repite la nueva contraseña"
              [class.rs-inp--error]="hasErr('confirmarPassword') || form.hasError('noCoinciden')">
            <button type="button" class="toggle-vis" (click)="verConfirmar.set(!verConfirmar())">
              <rs-icon [name]="verConfirmar() ? 'eye-off' : 'eye'" [size]="16" [stroke]="1.75"></rs-icon>
            </button>
          </div>
          @if (form.hasError('noCoinciden') && form.get('confirmarPassword')?.touched) {
            <span class="rs-field-err">Las contraseñas no coinciden.</span>
          }
        </div>

        <!-- Password strength hint -->
        @if (form.get('nuevaPassword')?.value) {
          <div class="strength-bar">
            <div class="strength-bar__fill" [style.width]="strengthWidth()" [style.background]="strengthColor()"></div>
          </div>
          <p class="strength-label" [style.color]="strengthColor()">{{ strengthLabel() }}</p>
        }

        @if (errorMsg()) {
          <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
        }
        @if (exito()) {
          <div class="rs-alert rs-alert--success">✓ Contraseña cambiada correctamente.</div>
        }

        <div class="form-actions">
          <a routerLink="/perfil" class="rs-btn rs-btn--ghost">Cancelar</a>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
            @if (guardando()) { Actualizando… } @else {
              <rs-icon name="lock" [size]="15" [stroke]="2"></rs-icon>
              Cambiar contraseña
            }
          </button>
        </div>

      </form>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-400); text-decoration: none;
      margin-bottom: var(--sp-6); transition: color var(--d-2);
      &:hover { color: var(--c-accent); }
    }

    .page-header {
      margin-bottom: var(--sp-8);
      h1 { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-2); }
      p { color: var(--t-400); font-size: var(--f-sm); }
    }

    .form-card { padding: var(--sp-8); max-width: 540px; }
    .security-icon {
      width: 52px; height: 52px; border-radius: var(--r-xl);
      background: var(--c-accent-lo); display: flex; align-items: center; justify-content: center;
      color: var(--c-accent); margin-bottom: var(--sp-6);
    }
    form { display: flex; flex-direction: column; gap: var(--sp-5); }

    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rs-lbl { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-300); }
    .input-wrap { position: relative; }
    .rs-inp {
      width: 100%; padding: var(--sp-3) var(--sp-11) var(--sp-3) var(--sp-4);
      background: var(--c-raised); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      color: var(--t-100); font-size: var(--f-base);
      transition: border-color var(--d-2), box-shadow var(--d-2);
      &:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
      &::placeholder { color: var(--t-500); }
    }
    .rs-inp--error { border-color: #EF4444; }
    .toggle-vis {
      position: absolute; right: var(--sp-3); top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: var(--t-400);
      display: flex; align-items: center;
      &:hover { color: var(--t-100); }
    }
    .rs-field-err { font-size: var(--f-xs); color: #B91C1C; }

    .strength-bar { height: 4px; background: var(--b-2); border-radius: var(--r-full); overflow: hidden; }
    .strength-bar__fill { height: 100%; border-radius: var(--r-full); transition: width .3s, background .3s; }
    .strength-label { font-size: var(--f-xs); font-weight: var(--w-5); }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); padding-top: var(--sp-4); border-top: 1px solid var(--b-1); }
  `],
})
export class PerfilSeguridadComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exito = signal(false);
  readonly verActual = signal(false);
  readonly verNueva = signal(false);
  readonly verConfirmar = signal(false);

  readonly form = this.fb.group({
    passwordActual:    ['', Validators.required],
    nuevaPassword:     ['', [Validators.required, Validators.minLength(8)]],
    confirmarPassword: ['', Validators.required],
  }, { validators: passwordsMatch });

  hasErr(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  strengthWidth(): string {
    const pwd = this.form.get('nuevaPassword')?.value ?? '';
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return `${score * 25}%`;
  }

  strengthColor(): string {
    const w = this.strengthWidth();
    if (w === '25%') return '#EF4444';
    if (w === '50%') return '#F59E0B';
    if (w === '75%') return '#3B82F6';
    return '#10B981';
  }

  strengthLabel(): string {
    const w = this.strengthWidth();
    if (w === '25%') return 'Contraseña débil';
    if (w === '50%') return 'Contraseña regular';
    if (w === '75%') return 'Contraseña buena';
    return 'Contraseña fuerte';
  }

  async cambiarPassword(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.guardando.set(true);
    this.errorMsg.set('');
    this.exito.set(false);

    const { passwordActual, nuevaPassword } = this.form.getRawValue();

    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/users/me/password`, { passwordActual, nuevaPassword }),
      );
      this.exito.set(true);
      this.form.reset();
      setTimeout(() => this.exito.set(false), 4000);
    } catch (err) {
      const msg = (err as HttpErrorResponse)?.error?.message;
      this.errorMsg.set(typeof msg === 'string' ? msg : 'No se pudo cambiar la contraseña.');
    } finally {
      this.guardando.set(false);
    }
  }
}
