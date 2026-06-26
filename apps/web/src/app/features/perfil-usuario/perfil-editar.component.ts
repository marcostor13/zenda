import { Component, signal, inject, computed, OnInit, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-perfil-editar',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsNavbarComponent, RsIconComponent, RsImageUploadComponent],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <!-- Breadcrumb -->
    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      Volver al perfil
    </a>

    <div class="page-header">
      <h1>Datos personales</h1>
      <p>Actualiza tu nombre, teléfono y foto de perfil.</p>
    </div>

    <div class="form-grid">

      <!-- Avatar section -->
      <div class="rs-card avatar-card">
        <h2>Foto de perfil</h2>
        <div class="avatar-preview">
          @if (avatarPreview()) {
            <img [src]="avatarPreview()" alt="Avatar" class="avatar-img" />
          } @else {
            <div class="avatar-initials">{{ iniciales() }}</div>
          }
        </div>
        <rs-image-upload
          [multiple]="false"
          [formControl]="avatarControl"
          style="display:block;margin-top:var(--sp-4)">
        </rs-image-upload>
        <p style="font-size:var(--f-xs);color:var(--t-400);text-align:center;margin-top:var(--sp-3)">
          La foto se actualiza al guardar el perfil.
        </p>
      </div>

      <!-- Profile form -->
      <div class="rs-card form-card">
        <h2>Información personal</h2>

        <form [formGroup]="form" (ngSubmit)="guardar()">

          <div class="rs-field">
            <label class="rs-lbl">Nombre completo *</label>
            <input class="rs-inp" formControlName="nombre" placeholder="Tu nombre"
                   [class.rs-inp--error]="hasErr('nombre')">
            @if (hasErr('nombre')) {
              <span class="rs-field-err">El nombre es obligatorio.</span>
            }
          </div>

          <div class="rs-field">
            <label class="rs-lbl">Email</label>
            <input class="rs-inp rs-inp--readonly" [value]="usuario()?.email ?? ''" readonly
                   title="El email no se puede cambiar aquí.">
            <span class="rs-field-hint">Para cambiar el email, contacta con soporte.</span>
          </div>

          <div class="rs-field">
            <label class="rs-lbl">Teléfono</label>
            <input class="rs-inp" formControlName="telefono" placeholder="+34 600 000 000" type="tel">
          </div>

          @if (errorMsg()) {
            <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
          }
          @if (exito()) {
            <div class="rs-alert rs-alert--success">¡Perfil actualizado correctamente.</div>
          }

          <div class="form-actions">
            <a routerLink="/perfil" class="rs-btn rs-btn--ghost">Cancelar</a>
            <button type="submit" class="rs-btn rs-btn--primary" [disabled]="guardando()">
              @if (guardando()) { Guardando… } @else {
                <rs-icon name="check" [size]="15" [stroke]="2"></rs-icon>
                Guardar cambios
              }
            </button>
          </div>

        </form>
      </div>

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

    .form-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: var(--sp-6);
      align-items: start;
      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .avatar-card { padding: var(--sp-6); display: flex; flex-direction: column; align-items: center; h2 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-4); width: 100%; } }
    .avatar-preview { width: 96px; height: 96px; border-radius: 50%; overflow: hidden; background: var(--g-accent); }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-initials { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: var(--f-2xl); font-weight: var(--w-8); color: #fff; }

    .form-card { padding: var(--sp-8); h2 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-6); } }
    form { display: flex; flex-direction: column; gap: var(--sp-5); }

    .rs-field { display: flex; flex-direction: column; gap: var(--sp-2); }
    .rs-lbl { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-300); }
    .rs-inp {
      width: 100%; padding: var(--sp-3) var(--sp-4);
      background: var(--c-raised); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      color: var(--t-100); font-size: var(--f-base);
      transition: border-color var(--d-2), box-shadow var(--d-2);
      &:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
      &::placeholder { color: var(--t-500); }
    }
    .rs-inp--error { border-color: #EF4444; }
    .rs-inp--readonly { opacity: .6; cursor: not-allowed; }
    .rs-field-err { font-size: var(--f-xs); color: #B91C1C; }
    .rs-field-hint { font-size: var(--f-xs); color: var(--t-400); }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--sp-3); padding-top: var(--sp-4); border-top: 1px solid var(--b-1); }
  `],
})
export class PerfilEditarComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly usuario = this.auth.usuario;
  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exito = signal(false);

  readonly avatarControl = new FormControl<string[]>([], { nonNullable: true });

  readonly iniciales = computed(() => {
    const nombre = this.usuario()?.nombre ?? '';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  readonly avatarPreview = computed(() => {
    const uploaded = this.avatarControl.value[0] ?? null;
    return uploaded ?? (this.usuario() as unknown as { avatarUrl?: string })?.avatarUrl ?? null;
  });

  readonly form = this.fb.group({
    nombre:   ['', [Validators.required, Validators.minLength(2)]],
    telefono: [''],
  });

  constructor() {
    effect(() => {
      const u = this.usuario();
      if (u) {
        this.form.patchValue({
          nombre:   u.nombre,
          telefono: (u as unknown as { telefono?: string }).telefono ?? '',
        });
      }
    });
  }

  ngOnInit(): void {}

  hasErr(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set('');
    this.exito.set(false);

    const payload: Record<string, unknown> = { ...this.form.getRawValue() };
    const uploadedAvatar = this.avatarControl.value[0];
    if (uploadedAvatar) payload['avatarUrl'] = uploadedAvatar;

    try {
      const updated = await firstValueFrom(
        this.http.patch<{ nombre: string; telefono?: string; avatarUrl?: string }>(
          `${environment.apiUrl}/users/me`, payload,
        ),
      );
      this.auth.actualizarDatosLocales({ nombre: updated.nombre });
      this.exito.set(true);
      setTimeout(() => this.exito.set(false), 3000);
    } catch {
      this.errorMsg.set('No se pudo actualizar el perfil. Intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
