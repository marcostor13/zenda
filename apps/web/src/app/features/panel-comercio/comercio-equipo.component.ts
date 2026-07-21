import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiembroEquipo } from './comercio-api.service';

const PUESTOS = [
  { valor: 'gerente', label: 'Gerente' },
  { valor: 'recepcion', label: 'Recepción' },
  { valor: 'peluquero', label: 'Peluquero/a' },
  { valor: 'veterinario', label: 'Veterinario/a' },
  { valor: 'cuidador', label: 'Cuidador/a' },
  { valor: 'otro', label: 'Otro' },
];

@Component({
  selector: 'app-comercio-equipo',
  standalone: true,
  imports: [ReactiveFormsModule, RsIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Equipo</h1>
        <p class="page-sub">Da de alta a tu personal con acceso al panel del negocio.</p>
      </div>
    </div>

    @if (okMsg()) { <div class="rs-alert rs-alert--success">{{ okMsg() }}</div> }
    @if (errorMsg()) { <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div> }

    <div class="equipo-grid">
      <!-- Lista -->
      <div class="rs-card panel">
        <h3 class="panel__title">Miembros del equipo</h3>
        @if (cargando()) {
          <p class="muted">Cargando…</p>
        } @else if (miembros().length === 0) {
          <p class="muted">Todavía no has añadido a nadie a tu equipo.</p>
        } @else {
          <div class="miembros">
            @for (m of miembros(); track m._id) {
              <div class="miembro">
                <div class="miembro__avatar">{{ m.nombre[0]?.toUpperCase() ?? '?' }}</div>
                <div class="miembro__info">
                  <strong>{{ m.nombre }}</strong>
                  <span>{{ m.email }}</span>
                </div>
                <span class="rs-badge {{ m.rol === 'comercio_admin' ? 'rs-badge--accent' : 'rs-badge--neutral' }}">
                  {{ m.rol === 'comercio_admin' ? 'Administrador' : (puestoLabel(m.puesto) || 'Staff') }}
                </span>
                @if (m.rol === 'comercio_staff') {
                  <button class="rs-btn rs-btn--ghost rs-btn--xs" [disabled]="eliminandoId() === m._id"
                          (click)="eliminar(m)">🗑️</button>
                } @else {
                  <span style="width:28px"></span>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Alta -->
      <div class="rs-card panel">
        <h3 class="panel__title">Añadir miembro</h3>
        <form [formGroup]="form" (ngSubmit)="crear()" class="form">
          <div class="rs-form-group">
            <label class="rs-label">Nombre</label>
            <input class="rs-input" formControlName="nombre" placeholder="Nombre y apellidos" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Email</label>
            <input class="rs-input" type="email" formControlName="email" placeholder="persona@negocio.com" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Contraseña temporal</label>
            <input class="rs-input" type="text" formControlName="password" placeholder="mínimo 8 caracteres" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Puesto</label>
            <select class="rs-input" formControlName="puesto">
              @for (p of puestos; track p.valor) { <option [value]="p.valor">{{ p.label }}</option> }
            </select>
          </div>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="form.invalid || guardando()">
            <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon>
            {{ guardando() ? 'Añadiendo…' : 'Añadir al equipo' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .page-header { margin-bottom: var(--sp-6); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .equipo-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--sp-5); @media (max-width: 900px) { grid-template-columns: 1fr; } }
    .panel { padding: var(--sp-6); }
    .panel__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); }
    .muted { color: var(--t-400); font-size: var(--f-sm); }
    .miembros { display: flex; flex-direction: column; gap: var(--sp-2); }
    .miembro { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); }
    .miembro__avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--g-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: var(--w-7); flex-shrink: 0; }
    .miembro__info { flex: 1; min-width: 0; strong { display: block; font-size: var(--f-sm); color: var(--t-100); } span { font-size: var(--f-xs); color: var(--t-400); } }
    .form { display: flex; flex-direction: column; gap: var(--sp-4); }
  `],
})
export class ComercioEquipoComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly fb = inject(FormBuilder);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly eliminandoId = signal('');
  readonly okMsg = signal('');
  readonly errorMsg = signal('');
  readonly miembros = signal<MiembroEquipo[]>([]);
  readonly puestos = PUESTOS;

  readonly form = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    puesto: ['recepcion'],
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.miembros.set(await firstValueFrom(this.comercioApi.getMiEquipo()));
    } catch {
      this.errorMsg.set('No se pudo cargar el equipo.');
    } finally {
      this.cargando.set(false);
    }
  }

  puestoLabel(valor?: string): string {
    return PUESTOS.find((p) => p.valor === valor)?.label ?? '';
  }

  async crear(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.okMsg.set('');
    this.errorMsg.set('');
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(this.comercioApi.crearMiembroEquipo({
        nombre: v.nombre!, email: v.email!, password: v.password!, puesto: v.puesto ?? undefined,
      }));
      this.okMsg.set('Miembro añadido al equipo.');
      this.form.reset({ puesto: 'recepcion' });
      await this.cargar();
    } catch {
      this.errorMsg.set('No se pudo añadir el miembro. ¿El email ya existe?');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(m: MiembroEquipo): Promise<void> {
    this.eliminandoId.set(m._id);
    try {
      await firstValueFrom(this.comercioApi.eliminarMiembroEquipo(m._id));
      this.miembros.update((list) => list.filter((x) => x._id !== m._id));
    } catch {
      this.errorMsg.set('No se pudo eliminar el miembro.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.eliminandoId.set('');
    }
  }
}
