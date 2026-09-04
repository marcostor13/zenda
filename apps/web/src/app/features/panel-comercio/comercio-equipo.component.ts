import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import {
  ESTADO_MIEMBRO_LABELS, EstadoMiembroEquipo,
  PERMISO_COMERCIO_DESCRIPCIONES, PERMISO_COMERCIO_LABELS, PermisoComercio,
} from 'shared';
import { ComercioApiService, MiembroEquipo, ActualizarMiembroEquipoPayload } from './comercio-api.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

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
  imports: [
    TraducirPipe, ReactiveFormsModule, RsIconComponent
  ],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ 'Equipo' | t }}</h1>
        <p class="page-sub">{{ 'Gestiona tu equipo, asigna roles y controla los accesos al panel de tu negocio.' | t }}</p>
      </div>
    </div>

    @if (okMsg()) { <div class="rs-alert rs-alert--success">{{ okMsg() }}</div> }
    @if (errorMsg()) { <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div> }

    <div class="equipo-grid">
      <!-- Lista -->
      <div class="rs-card panel">
        <h3 class="panel__title">{{ 'Miembros del equipo' | t }}</h3>
        @if (cargando()) {
          <p class="muted">{{ 'Cargando…' | t }}</p>
        } @else if (miembros().length === 0) {
          <p class="muted">{{ 'Todavía no has añadido a nadie a tu equipo.' | t }}</p>
        } @else {
          <div class="miembros">
            @for (m of miembros(); track m._id) {
              <div class="miembro" [class.miembro--inactivo]="m.activo === false">
                <div class="miembro__avatar">{{ m.nombre[0]?.toUpperCase() ?? '?' }}</div>
                <div class="miembro__info">
                  <strong>{{ m.nombre }}</strong>
                  <span>{{ m.email }}</span>
                  <!-- El puesto dice lo que hace; el acceso, lo que puede tocar (TCK-8026/8027) -->
                  <span class="miembro__acceso">
                    {{ m.rol === 'comercio_admin' ? 'Administrador' : (puestoLabel(m.puesto) || 'Sin puesto') }}
                    · acceso: {{ resumenAcceso(m) }}
                  </span>
                </div>

                <span class="rs-badge {{ badgeEstado(m) }}">{{ etiquetaEstado(m) }}</span>

                @if (m.rol === 'comercio_staff') {
                  <div class="miembro__acciones">
                    <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="abrirPermisos(m)">
                      <rs-icon name="settings" [size]="13" [stroke]="2"></rs-icon> {{ 'Permisos' | t }}
                    </button>
                    <button class="rs-btn rs-btn--ghost rs-btn--sm"
                            [disabled]="guardandoMiembroId() === m._id" (click)="alternarActivo(m)">
                      @if (m.activo === false) {
                        <rs-icon name="play" [size]="13" [stroke]="2"></rs-icon> Reactivar
                      } @else {
                        <rs-icon name="pause" [size]="13" [stroke]="2"></rs-icon> Desactivar
                      }
                    </button>
                    <button class="rs-btn rs-btn--ghost rs-btn--sm" [disabled]="eliminandoId() === m._id"
                            (click)="eliminar(m)" [attr.aria-label]="'Eliminar miembro del equipo' | t">
                      <rs-icon name="trash" [size]="13" [stroke]="2"></rs-icon>
                    </button>
                  </div>
                }
              </div>

              @if (editandoId() === m._id) {
                <div class="permisos-panel">
                  <div class="rs-form-group">
                    <label class="rs-label">{{ 'Puesto' | t }}</label>
                    <select class="rs-input" [value]="puestoEdit()"
                            (change)="puestoEdit.set($any($event.target).value)">
                      @for (p of puestos; track p.valor) { <option [value]="p.valor">{{ p.label | t }}</option> }
                    </select>
                  </div>

                  <label class="rs-label">{{ 'Qué puede ver y gestionar' | t }}</label>
                  <div class="permisos">
                    @for (p of permisosDisponibles; track p.valor) {
                      <label class="permiso">
                        <input type="checkbox" [checked]="tienePermiso(p.valor)" (change)="alternarPermiso(p.valor)" />
                        <span>
                          <strong>{{ p.label | t }}</strong>
                          <em>{{ p.descripcion }}</em>
                        </span>
                      </label>
                    }
                  </div>
                  <p class="muted">{{ 'Sin marcar nada, el miembro ve todo el panel del negocio.' | t }}</p>

                  <div class="permisos-panel__acciones">
                    <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarPermisos()">{{ 'Cancelar' | t }}</button>
                    <button class="rs-btn rs-btn--primary rs-btn--sm"
                            [disabled]="guardandoMiembroId() === m._id" (click)="guardarPermisos(m)">
                      {{ 'Guardar cambios' | t }}
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>

      <!-- Alta -->
      <div class="rs-card panel">
        <h3 class="panel__title">{{ 'Añadir miembro' | t }}</h3>
        <form [formGroup]="form" (ngSubmit)="crear()" class="form">
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Nombre' | t }}</label>
            <input class="rs-input" formControlName="nombre" [placeholder]="'Nombre y apellidos' | t" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Email' | t }}</label>
            <input class="rs-input" type="email" formControlName="email" placeholder="persona@negocio.com" inputmode="email" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Contraseña temporal' | t }}</label>
            <input class="rs-input" type="text" formControlName="password" [placeholder]="'mínimo 8 caracteres' | t" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">{{ 'Puesto' | t }}</label>
            <select class="rs-input" formControlName="puesto">
              @for (p of puestos; track p.valor) { <option [value]="p.valor">{{ p.label | t }}</option> }
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
    .miembro--inactivo { opacity: .6; border: 1px dashed var(--b-2); }
    .miembro__acceso { display: block; font-size: var(--f-xs); color: var(--t-400); }
    .miembro__acciones { display: flex; gap: var(--sp-1); flex-wrap: wrap; }

    .permisos-panel {
      padding: var(--sp-4); margin: calc(-1 * var(--sp-1)) 0 var(--sp-2);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      display: flex; flex-direction: column; gap: var(--sp-3);
    }
    .permisos-panel__acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); }
    .permisos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: var(--sp-2); }
    .permiso { display: flex; align-items: flex-start; gap: var(--sp-2); padding: var(--sp-2); background: var(--c-raised); border-radius: var(--r-md); cursor: pointer; }
    .permiso span { display: flex; flex-direction: column; gap: 2px; }
    .permiso strong { font-size: var(--f-sm); color: var(--t-100); }
    .permiso em { font-size: var(--f-xs); color: var(--t-400); font-style: normal; }
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

  /** Edición de puesto y acceso de un miembro (TCK-8026/8027). */
  readonly permisosDisponibles = Object.values(PermisoComercio).map((valor) => ({
    valor,
    label: PERMISO_COMERCIO_LABELS[valor],
    descripcion: PERMISO_COMERCIO_DESCRIPCIONES[valor],
  }));
  readonly editandoId = signal('');
  readonly permisosEdit = signal<string[]>([]);
  readonly puestoEdit = signal('');
  readonly guardandoMiembroId = signal('');

  /** Un miembro sin permisos marcados ve todo: es como funcionaba antes. */
  resumenAcceso(m: MiembroEquipo): string {
    const permisos = m.permisosComercio ?? [];
    if (!permisos.length) return 'todo el panel';
    return permisos.map((p) => PERMISO_COMERCIO_LABELS[p as PermisoComercio] ?? p).join(', ');
  }

  estadoDe(m: MiembroEquipo): EstadoMiembroEquipo {
    if (m.activo === false) return EstadoMiembroEquipo.DESACTIVADO;
    if (m.requiereVerificacionEmail && !m.verificado) return EstadoMiembroEquipo.INVITACION_PENDIENTE;
    return EstadoMiembroEquipo.ACTIVO;
  }

  etiquetaEstado(m: MiembroEquipo): string {
    return ESTADO_MIEMBRO_LABELS[this.estadoDe(m)];
  }

  badgeEstado(m: MiembroEquipo): string {
    const estado = this.estadoDe(m);
    if (estado === EstadoMiembroEquipo.ACTIVO) return 'rs-badge--success';
    if (estado === EstadoMiembroEquipo.INVITACION_PENDIENTE) return 'rs-badge--warning';
    return 'rs-badge--neutral';
  }

  abrirPermisos(m: MiembroEquipo): void {
    this.editandoId.set(this.editandoId() === m._id ? '' : m._id);
    this.permisosEdit.set([...(m.permisosComercio ?? [])]);
    this.puestoEdit.set(m.puesto ?? '');
  }

  cerrarPermisos(): void {
    this.editandoId.set('');
  }

  tienePermiso(permiso: string): boolean {
    return this.permisosEdit().includes(permiso);
  }

  alternarPermiso(permiso: string): void {
    this.permisosEdit.update((lista) =>
      lista.includes(permiso) ? lista.filter((p) => p !== permiso) : [...lista, permiso],
    );
  }

  async guardarPermisos(m: MiembroEquipo): Promise<void> {
    await this.actualizarMiembro(m, {
      puesto: this.puestoEdit() || undefined,
      permisosComercio: this.permisosEdit(),
    });
    this.cerrarPermisos();
  }

  /** Desactivar conserva el historial; eliminar lo perdería. */
  async alternarActivo(m: MiembroEquipo): Promise<void> {
    await this.actualizarMiembro(m, { activo: m.activo === false });
  }

  private async actualizarMiembro(m: MiembroEquipo, cambios: ActualizarMiembroEquipoPayload): Promise<void> {
    this.guardandoMiembroId.set(m._id);
    this.errorMsg.set('');
    try {
      const actualizado = await firstValueFrom(this.comercioApi.actualizarMiembroEquipo(m._id, cambios));
      this.miembros.update((lista) => lista.map((x) => (x._id === m._id ? { ...x, ...actualizado } : x)));
      this.okMsg.set('Equipo actualizado.');
      setTimeout(() => this.okMsg.set(''), 3000);
    } catch {
      this.errorMsg.set('No se pudo actualizar al miembro del equipo.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.guardandoMiembroId.set('');
    }
  }
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
