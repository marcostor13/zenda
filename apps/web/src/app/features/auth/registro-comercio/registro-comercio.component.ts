import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AuthService } from '../../../core/auth/auth.service';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';

@Component({
  selector: 'app-registro-comercio',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, RsIconComponent],
  template: `
    <div class="rs-auth">
      <div class="rs-auth__card" style="max-width:560px">

        <div class="rs-auth__brand">
          <img src="/images/logo-doogking.jpg" alt="Doogking" style="height:120px;width:auto;display:block;margin-inline:auto;margin-bottom:var(--sp-3)" />
          <p>Hazte partner de Doogking</p>
          <p style="font-size:var(--f-sm);color:var(--t-400);margin-top:var(--sp-1)">
            Publica tus servicios caninos y recibe reservas online.
          </p>
        </div>

        <form [formGroup]="formulario" (ngSubmit)="onSubmit()" class="rs-auth__form">

          <h3 style="font-size:var(--f-sm);font-weight:var(--w-7);color:var(--t-300);text-transform:uppercase;letter-spacing:.04em;margin-bottom:var(--sp-2)">
            Tu cuenta
          </h3>

          <div class="rs-field">
            <label for="nombre" class="rs-lbl">Tu nombre</label>
            <input id="nombre" type="text" formControlName="nombre" class="rs-inp"
                   [class.rs-inp--error]="invalido('nombre')" placeholder="Nombre y apellidos" />
            @if (invalido('nombre')) { <span class="rs-field-err">Ingresa tu nombre (mínimo 2 caracteres)</span> }
          </div>

          <div class="rs-field">
            <label for="email" class="rs-lbl">Correo electrónico</label>
            <input id="email" type="email" formControlName="email" class="rs-inp"
                   [class.rs-inp--error]="invalido('email')" placeholder="tu@negocio.com" />
            @if (invalido('email')) { <span class="rs-field-err">Ingresa un email válido</span> }
          </div>

          <div class="rs-field">
            <label for="password" class="rs-lbl">Contraseña</label>
            <div style="position:relative">
              <input id="password" [type]="mostrarPassword() ? 'text' : 'password'" formControlName="password"
                     class="rs-inp" [class.rs-inp--error]="invalido('password')"
                     style="padding-right:var(--sp-10)" placeholder="Mínimo 8 caracteres" />
              <button type="button" (click)="mostrarPassword.set(!mostrarPassword())"
                      style="position:absolute;right:var(--sp-3);top:50%;transform:translateY(-50%);display:flex;align-items:center"
                      [style.color]="mostrarPassword() ? 'var(--c-accent)' : 'var(--t-400)'">
                <rs-icon [name]="mostrarPassword() ? 'eye-off' : 'eye'" [size]="16" [stroke]="2"></rs-icon>
              </button>
            </div>
            @if (invalido('password')) { <span class="rs-field-err">La contraseña debe tener al menos 8 caracteres</span> }
          </div>

          <h3 style="font-size:var(--f-sm);font-weight:var(--w-7);color:var(--t-300);text-transform:uppercase;letter-spacing:.04em;margin:var(--sp-5) 0 var(--sp-2)">
            Tu negocio
          </h3>

          <div class="rs-field">
            <label for="nombreComercial" class="rs-lbl">Nombre comercial</label>
            <input id="nombreComercial" type="text" formControlName="nombreComercial" class="rs-inp"
                   [class.rs-inp--error]="invalido('nombreComercial')" placeholder="Ej. Royal Dog Resort" />
            @if (invalido('nombreComercial')) { <span class="rs-field-err">Ingresa el nombre comercial</span> }
          </div>

          <div class="rs-field">
            <label for="razonSocial" class="rs-lbl">Razón social</label>
            <input id="razonSocial" type="text" formControlName="razonSocial" class="rs-inp"
                   [class.rs-inp--error]="invalido('razonSocial')" placeholder="Ej. Royal Dog Resort S.L." />
            @if (invalido('razonSocial')) { <span class="rs-field-err">Ingresa la razón social</span> }
          </div>

          <div class="rs-field">
            <label for="vatNumber" class="rs-lbl">Número de IVA / identificador fiscal</label>
            <input id="vatNumber" type="text" formControlName="vatNumber" class="rs-inp"
                   [class.rs-inp--error]="invalido('vatNumber')" placeholder="Ej. ES-B12345678" />
            @if (invalido('vatNumber')) { <span class="rs-field-err">Ingresa tu identificador fiscal</span> }
          </div>

          <div class="rs-field">
            <label class="rs-lbl">Categorías que ofreces</label>
            <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
              @for (v of verticalesDisponibles; track v.key) {
                <label class="rs-badge {{ estaSeleccionada(v.key) ? 'rs-badge--accent' : 'rs-badge--neutral' }}"
                       style="cursor:pointer;user-select:none">
                  <input type="checkbox" [checked]="estaSeleccionada(v.key)" (change)="toggleVertical(v.key)"
                         style="display:none" />
                  {{ v.label }}
                </label>
              }
            </div>
          </div>

          @if (error()) {
            <div class="rs-alert rs-alert--error">{{ error() }}</div>
          }

          <button type="submit" class="rs-btn rs-btn--primary rs-btn--block rs-btn--lg"
                  [disabled]="formulario.invalid || cargando()">
            @if (cargando()) { <span class="rs-spin"></span> }
            {{ cargando() ? 'Creando tu negocio…' : 'Registrar mi negocio' }}
          </button>
        </form>

        <p style="font-size:var(--f-xs);color:var(--t-400);text-align:center;margin-top:var(--sp-4);line-height:1.5">
          Tu comercio quedará <strong>pendiente de aprobación</strong> por el equipo de Doogking antes de publicarse.
        </p>

        <div class="rs-auth__footer">
          ¿Eres dueño de un perro? <a routerLink="/auth/registro">Crea tu cuenta de cliente</a>
        </div>
      </div>
    </div>
  `,
})
export class RegistroComercioComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mostrarPassword = signal(false);
  readonly verticalesSel = signal<VerticalKey[]>([]);

  readonly verticalesDisponibles = Object.values(VerticalKey).map((key) => ({
    key,
    label: VERTICAL_LABELS[key],
  }));

  readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    nombreComercial: ['', [Validators.required]],
    razonSocial: ['', [Validators.required]],
    vatNumber: ['', [Validators.required]],
  });

  invalido(control: string): boolean {
    const c = this.formulario.get(control);
    return !!c && c.invalid && c.touched;
  }

  estaSeleccionada(v: VerticalKey): boolean {
    return this.verticalesSel().includes(v);
  }

  toggleVertical(v: VerticalKey): void {
    this.verticalesSel.update((lista) =>
      lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v],
    );
  }

  async onSubmit(): Promise<void> {
    if (this.formulario.invalid) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      await this.authService.registrarComercio({
        nombre: this.formulario.value.nombre!,
        email: this.formulario.value.email!,
        password: this.formulario.value.password!,
        nombreComercial: this.formulario.value.nombreComercial!,
        razonSocial: this.formulario.value.razonSocial!,
        vatNumber: this.formulario.value.vatNumber!,
        verticales: this.verticalesSel().length ? this.verticalesSel() : undefined,
      });
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 409) {
        this.error.set('Ese email o identificador fiscal ya está registrado.');
      } else {
        this.error.set('Error al registrar tu negocio. Inténtalo de nuevo.');
      }
    } finally {
      this.cargando.set(false);
    }
  }
}
