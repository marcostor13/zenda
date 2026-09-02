import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RsNavbarComponent } from '../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { RsImageUploadComponent } from '../../shared/components/image-upload/rs-image-upload.component';
import { RsPhoneInputComponent } from '../../shared/components/phone-input/rs-phone-input.component';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

/** Lo que devuelve `GET /users/me`; la sesión sólo trae una parte. */
interface PerfilUsuario {
  nombre: string;
  email?: string;
  telefono?: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-perfil-editar',
  standalone: true,
  imports: [
    TraducirPipe, RouterLink, ReactiveFormsModule, RsNavbarComponent,
    RsIconComponent, RsImageUploadComponent, RsPhoneInputComponent,
  ],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <!-- Breadcrumb -->
    <a routerLink="/perfil" class="back-link">
      <rs-icon name="arrow-left" [size]="14" [stroke]="2"></rs-icon>
      {{ 'Volver al perfil' | t }}
    </a>

    <div class="page-header">
      <h1>{{ 'Datos personales' | t }}</h1>
      <p>{{ 'Actualiza tu nombre, teléfono y foto de perfil.' | t }}</p>
    </div>

    <div class="form-grid">

      <!-- Avatar section -->
      <div class="rs-card avatar-card">
        <h2>{{ 'Foto de perfil' | t }}</h2>
        <div class="avatar-preview">
          @if (avatarPreview()) {
            <img [src]="avatarPreview()" [alt]="'Avatar' | t" class="avatar-img" />
          } @else {
            <div class="avatar-initials">{{ iniciales() }}</div>
          }
        </div>
        <rs-image-upload
          origen="perfil/avatar"
          [multiple]="false"
          [formControl]="avatarControl"
          style="display:block;margin-top:var(--sp-4)">
        </rs-image-upload>
        <p style="font-size:var(--f-xs);color:var(--t-400);text-align:center;margin-top:var(--sp-3)">
          {{ 'La foto se actualiza al guardar el perfil.' | t }}
        </p>
      </div>

      <!-- Profile form -->
      <div class="rs-card form-card">
        <h2>{{ 'Información personal' | t }}</h2>

        <form [formGroup]="form" (ngSubmit)="guardar()">

          <div class="rs-field">
            <label class="rs-lbl">{{ 'Nombre completo *' | t }}</label>
            <input class="rs-inp" formControlName="nombre" [placeholder]="'Tu nombre' | t"
                   [class.rs-inp--error]="hasErr('nombre')">
            @if (hasErr('nombre')) {
              <span class="rs-field-err">{{ 'El nombre es obligatorio.' | t }}</span>
            }
          </div>

          <div class="rs-field">
            <label class="rs-lbl">{{ 'Email' | t }}</label>
            <input class="rs-inp rs-inp--readonly" [value]="usuario()?.email ?? ''" readonly
                   [title]="'El email no se puede cambiar aquí.' | t">
            <span class="rs-field-hint">{{ 'Para cambiar el email, contacta con soporte.' | t }}</span>
          </div>

          <div class="rs-field">
            <label class="rs-lbl">{{ 'Teléfono' | t }}</label>
            <rs-phone-input formControlName="telefono" [etiqueta]="'Teléfono' | t" />
          </div>

          @if (errorMsg()) {
            <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
          }
          @if (exito()) {
            <div class="rs-alert rs-alert--success">{{ '¡Perfil actualizado correctamente.' | t }}</div>
          }

          <div class="form-actions">
            <a routerLink="/perfil" class="rs-btn rs-btn--ghost">{{ 'Cancelar' | t }}</a>
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
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly errorMsg = signal('');
  readonly exito = signal(false);

  /**
   * Perfil completo, tal como lo guarda el API.
   *
   * Hace falta pedirlo: la sesión de `AuthService` sólo lleva nombre, email y
   * rol, así que el teléfono y el avatar **no estaban en ninguna parte** y la
   * pantalla abría siempre en blanco. El usuario rellenaba el teléfono, lo
   * guardaba, volvía a entrar y lo veía vacío otra vez.
   */
  private readonly perfil = signal<PerfilUsuario | null>(null);

  /**
   * Con `[multiple]="false"`, `rs-image-upload` emite **la URL suelta**, no un
   * array (ver su `emitValue`). Tipar esto como `string[]` hacía que
   * `value[0]` devolviera la primera letra de la URL: el perfil se guardaba
   * con un avatar que era literalmente la cadena "h".
   */
  readonly avatarControl = new FormControl<string | null>(null);

  readonly iniciales = computed(() => {
    const nombre = this.perfil()?.nombre ?? this.usuario()?.nombre ?? '';
    return nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  /** El `FormControl` no es una señal: sin esto la vista previa seguiría
   *  mostrando la foto antigua después de subir una nueva. */
  private readonly avatarSubido = toSignal(this.avatarControl.valueChanges, { initialValue: null });

  readonly avatarPreview = computed(() => this.avatarSubido() ?? this.perfil()?.avatarUrl ?? null);

  readonly form = this.fb.group({
    nombre:   ['', [Validators.required, Validators.minLength(2)]],
    telefono: [''],
  });

  async ngOnInit(): Promise<void> {
    await this.cargarPerfil();
  }

  /**
   * Trae el perfil guardado y rellena el formulario.
   *
   * No se hace en un `effect` sobre la sesión, como antes: `actualizarDatosLocales`
   * la modifica al guardar, el efecto volvía a dispararse y machacaba el
   * teléfono recién escrito con la cadena vacía. Parecía que no se guardaba.
   */
  private async cargarPerfil(): Promise<void> {
    try {
      const perfil = await firstValueFrom(
        this.http.get<PerfilUsuario>(`${environment.apiUrl}/users/me`),
      );
      this.aplicarPerfil(perfil);
    } catch {
      // Sin el perfil se puede seguir editando: se parte de lo que hay en la
      // sesión y se guarda igual.
      const sesion = this.usuario();
      if (sesion) this.form.patchValue({ nombre: sesion.nombre });
      this.errorMsg.set('No hemos podido cargar tus datos. Revisa lo que hay antes de guardar.');
    } finally {
      this.cargando.set(false);
    }
  }

  private aplicarPerfil(perfil: PerfilUsuario): void {
    this.perfil.set(perfil);
    this.form.patchValue({
      nombre: perfil.nombre ?? '',
      telefono: perfil.telefono ?? '',
    });
    // `emitEvent: false` para que la vista previa siga saliendo de `perfil()`:
    // el control sólo debe avisar cuando el usuario sube una foto nueva.
    this.avatarControl.setValue(perfil.avatarUrl ?? null, { emitEvent: false });
    this.form.markAsPristine();
  }

  hasErr(campo: string): boolean {
    const c = this.form.get(campo);
    return !!(c?.invalid && c.touched);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.guardando.set(true);
    this.errorMsg.set('');
    this.exito.set(false);

    const { nombre, telefono } = this.form.getRawValue();
    const avatarUrl = this.avatarControl.value;

    try {
      const actualizado = await firstValueFrom(
        this.http.patch<PerfilUsuario>(`${environment.apiUrl}/users/me`, {
          nombre,
          telefono,
          // Sólo si hay foto: mandar `null` haría que el API la borrase.
          ...(avatarUrl ? { avatarUrl } : {}),
        }),
      );

      this.aplicarPerfil(actualizado);
      /*
       * La sesión también se pone al día: el nombre y el avatar salen en la
       * barra de navegación, y sin esto seguían siendo los de antes hasta
       * cerrar y volver a entrar.
       */
      this.auth.actualizarDatosLocales({ nombre: actualizado.nombre });

      this.exito.set(true);
      setTimeout(() => this.exito.set(false), 3000);
    } catch {
      this.errorMsg.set('No se pudo actualizar el perfil. Intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
