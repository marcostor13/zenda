import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { AdminApiService, ComercioAdmin, CrearComercioDto, ActualizarComercioDto } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { iconoVertical } from '../panel-comercio/vertical-icon';

const VERTICAL_EMOJI: Record<string, string> = {
  [VerticalKey.ALOJAMIENTO]: '🏠',
  [VerticalKey.TRANSPORTE]: '🚛',
  [VerticalKey.VETERINARIA]: '🩺',
  [VerticalKey.PELUQUERIA]: '✂️',
  [VerticalKey.ADIESTRAMIENTO]: '🎓',
  [VerticalKey.HOTELES]: '🏨',
};

const FILTROS = [
  { label: 'Todos', valor: '' },
  { label: 'Pendientes', valor: 'pendiente' },
  { label: 'Activos', valor: 'activo' },
  { label: 'Suspendidos', valor: 'suspendido' },
] as const;

const VERTICALES_OPCIONES = Object.values(VerticalKey);
const LIMITE = 20;

@Component({
  selector: 'app-admin-comercios',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RsIconComponent],
  template: `
    <!-- Cabecera -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Comercios</h1>
        <p class="page-sub">Gestiona los comercios registrados en la plataforma.</p>
      </div>
      <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
        <div class="page-kpi rs-card">
          <span class="kpi-num">{{ total() }}</span>
          <span class="kpi-lbl">{{ filtroEstado() ? filtroEstado() + 's' : 'total' }}</span>
        </div>
        <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="abrirCrear()">+ Nuevo comercio</button>
      </div>
    </div>

    <!-- Barra de filtros + búsqueda -->
    <div class="toolbar">
      <div class="filter-bar">
        @for (f of filtros; track f.valor) {
          <button
            class="rs-btn rs-btn--sm"
            [class.rs-btn--primary]="filtroEstado() === f.valor"
            [class.rs-btn--ghost]="filtroEstado() !== f.valor"
            (click)="setFiltro(f.valor)">
            {{ f.label }}
          </button>
        }
      </div>
      <input
        class="rs-inp search-input"
        type="text"
        placeholder="Buscar por nombre, razón social o RUC…"
        [value]="buscar()"
        (input)="onBuscar($event)" />
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
    }

    <!-- Tabla -->
    <div class="rs-card" style="padding:0;overflow:hidden">
      <div class="tbl-head">
        <span>Comercio</span>
        <span>RUC</span>
        <span>Plan</span>
        <span>Estado</span>
        <span>Registro</span>
        <span>Acciones</span>
      </div>

      @if (cargando()) {
        @for (i of [1,2,3,4,5]; track i) {
          <div class="tbl-row tbl-skeleton">
            <div class="skel skel--lg"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--md"></div>
          </div>
        }
      } @else {
        @for (c of comercios(); track c._id) {
          <div class="tbl-row">
            <div class="comercio-cell">
              <div class="comercio-avatar">{{ c.nombreComercial[0]?.toUpperCase() ?? 'C' }}</div>
              <div>
                <div class="cell-primary">{{ c.nombreComercial }}</div>
                <div class="cell-muted">{{ c.razonSocial }}</div>
                <div class="verticales-pills">
                  @for (v of c.verticales; track v) {
                    <span class="rs-badge rs-badge--neutral" style="display:inline-flex;align-items:center;gap:4px">
                    <rs-icon [name]="iconVertical(v)" [size]="11" [stroke]="2"></rs-icon>{{ labelVertical(v) }}
                  </span>
                  }
                </div>
              </div>
            </div>
            <span class="cell-mono">{{ c.vatNumber }}</span>
            <span>
              <span class="rs-badge rs-badge--accent">{{ c.plan }}</span>
            </span>
            <span>
              <span class="rs-badge {{ badgeEstado(c.estado) }}">{{ c.estado }}</span>
            </span>
            <span class="cell-muted">{{ c.createdAt | date:'d MMM yyyy' }}</span>
            <div class="acciones">
              @if (c.estado !== 'activo') {
                <button class="rs-btn rs-btn--sm" style="background:var(--c-teal);color:#fff"
                  [disabled]="accionando() === c._id" (click)="aprobar(c._id)">✓ Aprobar</button>
              }
              @if (c.estado !== 'suspendido') {
                <button class="rs-btn rs-btn--danger rs-btn--sm"
                  [disabled]="accionando() === c._id" (click)="suspender(c._id)">Suspender</button>
              }
              <button class="rs-btn rs-btn--ghost rs-btn--sm"
                [disabled]="accionando() === c._id" (click)="abrirEditar(c)">✏️</button>
              <button class="rs-btn rs-btn--ghost rs-btn--sm" style="color:#F87171"
                [disabled]="accionando() === c._id" (click)="confirmarEliminar(c)">🗑️</button>
            </div>
          </div>
        }
        @if (comercios().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">🏪</span>
            <p>No hay comercios {{ filtroEstado() ? 'con estado "' + filtroEstado() + '"' : '' }}</p>
          </div>
        }
      }
    </div>

    <!-- Paginación -->
    @if (totalPaginas() > 1) {
      <div class="pagination">
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() <= 1" (click)="cambiarPagina(paginaActual() - 1)">← Anterior</button>
        <span class="page-info">Página {{ paginaActual() }} de {{ totalPaginas() }} · {{ total() }} comercios</span>
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() >= totalPaginas()" (click)="cambiarPagina(paginaActual() + 1)">Siguiente →</button>
      </div>
    }

<!-- MODAL CREAR / EDITAR -->
@if (modalVisible()) {
  <div class="overlay" (click)="cerrarModal()">
    <div class="modal rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">{{ editandoId() ? 'Editar comercio' : 'Nuevo comercio' }}</h2>

      <form [formGroup]="form" (ngSubmit)="guardar()">

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">Nombre comercial *</label>
            <input formControlName="nombreComercial" class="rs-input" placeholder="Mi Hotel SA" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Razón social *</label>
            <input formControlName="razonSocial" class="rs-input" placeholder="Mi Hotel SAC" />
          </div>
        </div>

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">RUC *</label>
            <input formControlName="vatNumber" class="rs-input" placeholder="20123456789"
              [attr.readonly]="editandoId() ? true : null" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Logo URL</label>
            <input formControlName="logoUrl" class="rs-input" placeholder="https://..." />
          </div>
        </div>

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">Plan</label>
            <select formControlName="plan" class="rs-input">
              <option value="basico">Básico</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Estado</label>
            <select formControlName="estado" class="rs-input">
              <option value="pendiente">Pendiente</option>
              <option value="activo">Activo</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </div>

        <div class="rs-form-group">
          <label class="rs-label">Comisión override (%)</label>
          <input formControlName="comisionPctOverride" type="number" step="0.01" min="0" max="1" class="rs-input"
            placeholder="Dejar en blanco para usar el default del vertical" />
        </div>

        <div class="rs-form-group">
          <label class="rs-label">Verticales</label>
          <div class="verticales-check">
            @for (v of verticalesOpciones; track v) {
              <label class="check-item">
                <input type="checkbox"
                  [checked]="verticalesSeleccionadas().includes(v)"
                  (change)="toggleVertical(v)" />
                <rs-icon [name]="iconVertical(v)" [size]="14" [stroke]="2"></rs-icon> {{ labelVertical(v) }}
              </label>
            }
          </div>
        </div>

        @if (modalError()) {
          <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="cerrarModal()">Cancelar</button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="form.invalid || guardando()">
            {{ guardando() ? 'Guardando…' : (editandoId() ? 'Guardar cambios' : 'Crear comercio') }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- MODAL CONFIRMAR ELIMINAR -->
@if (eliminarComercio()) {
  <div class="overlay" (click)="cancelarEliminar()">
    <div class="modal modal--sm rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">Eliminar comercio</h2>
      <p style="color:var(--t-300);margin-bottom:var(--sp-5)">
        ¿Estás seguro de que quieres eliminar
        <strong style="color:var(--t-100)">{{ eliminarComercio()!.nombreComercial }}</strong>?
        Esta acción no se puede deshacer.
      </p>
      @if (modalError()) {
        <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
      }
      <div class="modal-actions">
        <button class="rs-btn rs-btn--ghost" (click)="cancelarEliminar()">Cancelar</button>
        <button class="rs-btn rs-btn--danger" [disabled]="guardando()" (click)="ejecutarEliminar()">
          {{ guardando() ? 'Eliminando…' : 'Eliminar' }}
        </button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-6); margin-bottom: var(--sp-6); flex-wrap: wrap; }
    .back-link { font-size: var(--f-sm); color: var(--c-accent); text-decoration: none; display: inline-block; margin-bottom: var(--sp-2); }
    .back-link:hover { text-decoration: underline; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .page-kpi { padding: var(--sp-4) var(--sp-6); text-align: center; min-width: 100px; }
    .kpi-num { display: block; font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .toolbar { display: flex; gap: var(--sp-4); margin-bottom: var(--sp-5); flex-wrap: wrap; align-items: center; }
    .filter-bar { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 240px; max-width: 360px; }

    .tbl-head { display: grid; grid-template-columns: 2fr 130px 90px 120px 120px 240px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); }
    .tbl-row { display: grid; grid-template-columns: 2fr 130px 90px 120px 120px 240px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; }
    .tbl-row:last-child { border: none; }
    .tbl-row:hover { background: var(--c-raised); }
    .tbl-skeleton { pointer-events: none; }

    .comercio-cell { display: flex; align-items: flex-start; gap: var(--sp-3); }
    .comercio-avatar { width: 36px; height: 36px; border-radius: var(--r-lg); background: var(--g-accent); display: flex; align-items: center; justify-content: center; font-size: var(--f-sm); font-weight: var(--w-7); color: #fff; flex-shrink: 0; }
    .cell-primary { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .cell-muted { font-size: var(--f-xs); color: var(--t-400); }
    .cell-mono { font-family: monospace; font-size: var(--f-xs); color: var(--t-300); }
    .verticales-pills { display: flex; gap: var(--sp-1); flex-wrap: wrap; margin-top: var(--sp-1); }
    .acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center; }

    .skel { background: var(--c-raised); border-radius: var(--r-sm); height: 16px; animation: pulse 1.4s ease-in-out infinite; }
    .skel--sm { width: 80px; } .skel--md { width: 120px; } .skel--lg { width: 180px; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

    .empty-state { padding: var(--sp-16); text-align: center; color: var(--t-400); }
    .empty-icon { font-size: 2.5rem; display: block; margin-bottom: var(--sp-3); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-6); }
    .page-info { font-size: var(--f-sm); color: var(--t-400); }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--sp-4); }
    .modal { width: 100%; max-width: 640px; padding: var(--sp-8); max-height: 90vh; overflow-y: auto; }
    .modal--sm { max-width: 420px; }
    .modal-title { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-6); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
    @media (max-width: 540px) { .form-row { grid-template-columns: 1fr; } }
    .modal-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; margin-top: var(--sp-6); }

    .verticales-check { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin-top: var(--sp-2); }
    .check-item { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-200); cursor: pointer; }
    .check-item input { accent-color: var(--c-accent); width: 16px; height: 16px; }
  `],
})
export class AdminComerciosComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly buscarSubject = new Subject<string>();

  readonly cargando = signal(true);
  readonly comercios = signal<ComercioAdmin[]>([]);
  readonly total = signal(0);
  readonly paginaActual = signal(1);
  readonly filtroEstado = signal('');
  readonly buscar = signal('');
  readonly errorMsg = signal('');
  readonly accionando = signal<string | null>(null);

  readonly modalVisible = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly modalError = signal('');
  readonly eliminarComercio = signal<ComercioAdmin | null>(null);
  readonly verticalesSeleccionadas = signal<string[]>([]);

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));
  readonly filtros = FILTROS;
  readonly verticalesOpciones = VERTICALES_OPCIONES;

  readonly form = this.fb.group({
    nombreComercial: ['', Validators.required],
    razonSocial: ['', Validators.required],
    vatNumber: ['', Validators.required],
    logoUrl: [''],
    plan: ['basico'],
    estado: ['activo'],
    comisionPctOverride: [null as number | null],
  });

  constructor() {
    this.buscarSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(valor => {
      this.buscar.set(valor);
      this.paginaActual.set(1);
      void this.cargar();
    });
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const result = await firstValueFrom(this.adminApi.getComercios({
        page: this.paginaActual(),
        limite: LIMITE,
        estado: this.filtroEstado() || undefined,
        buscar: this.buscar() || undefined,
      }));
      this.comercios.set(result.items);
      this.total.set(result.total);
    } catch {
      this.errorMsg.set('Error cargando los comercios. Verifica que la API esté activa.');
    } finally {
      this.cargando.set(false);
    }
  }

  async setFiltro(estado: string): Promise<void> {
    this.filtroEstado.set(estado);
    this.paginaActual.set(1);
    await this.cargar();
  }

  onBuscar(event: Event): void {
    this.buscarSubject.next((event.target as HTMLInputElement).value);
  }

  async cambiarPagina(pagina: number): Promise<void> {
    this.paginaActual.set(pagina);
    await this.cargar();
  }

  async aprobar(id: string): Promise<void> {
    this.accionando.set(id);
    try {
      await firstValueFrom(this.adminApi.aprobarComercio(id));
      await this.cargar();
    } catch {
      this.errorMsg.set('Error al aprobar el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }

  async suspender(id: string): Promise<void> {
    this.accionando.set(id);
    try {
      await firstValueFrom(this.adminApi.rechazarComercio(id));
      await this.cargar();
    } catch {
      this.errorMsg.set('Error al suspender el comercio.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.accionando.set(null);
    }
  }

  abrirCrear(): void {
    this.editandoId.set(null);
    this.verticalesSeleccionadas.set([]);
    this.form.reset({ plan: 'basico', estado: 'activo' });
    this.form.get('vatNumber')!.enable();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  abrirEditar(c: ComercioAdmin): void {
    this.editandoId.set(c._id);
    this.verticalesSeleccionadas.set([...c.verticales]);
    this.form.patchValue({
      nombreComercial: c.nombreComercial,
      razonSocial: c.razonSocial,
      vatNumber: c.vatNumber,
      logoUrl: c.logoUrl ?? '',
      plan: c.plan,
      estado: c.estado,
      comisionPctOverride: c.comisionPctOverride ?? null,
    });
    this.form.get('vatNumber')!.disable();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  cerrarModal(): void {
    this.modalVisible.set(false);
    this.editandoId.set(null);
  }

  toggleVertical(v: string): void {
    const actual = this.verticalesSeleccionadas();
    if (actual.includes(v)) {
      this.verticalesSeleccionadas.set(actual.filter(x => x !== v));
    } else {
      this.verticalesSeleccionadas.set([...actual, v]);
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.modalError.set('');
    const v = this.form.getRawValue();
    try {
      if (this.editandoId()) {
        const dto: ActualizarComercioDto = {
          nombreComercial: v.nombreComercial!,
          razonSocial: v.razonSocial!,
          logoUrl: v.logoUrl || undefined,
          verticales: this.verticalesSeleccionadas(),
          plan: v.plan!,
          estado: v.estado!,
          comisionPctOverride: v.comisionPctOverride ?? undefined,
        };
        await firstValueFrom(this.adminApi.actualizarComercio(this.editandoId()!, dto));
      } else {
        const dto: CrearComercioDto = {
          nombreComercial: v.nombreComercial!,
          razonSocial: v.razonSocial!,
          vatNumber: v.vatNumber!,
          logoUrl: v.logoUrl || undefined,
          verticales: this.verticalesSeleccionadas(),
          plan: v.plan!,
          estado: v.estado!,
        };
        await firstValueFrom(this.adminApi.crearComercio(dto));
      }
      this.cerrarModal();
      await this.cargar();
    } catch {
      this.modalError.set('Error guardando el comercio. Verifica los datos e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  confirmarEliminar(c: ComercioAdmin): void {
    this.eliminarComercio.set(c);
    this.modalError.set('');
  }

  cancelarEliminar(): void {
    this.eliminarComercio.set(null);
  }

  async ejecutarEliminar(): Promise<void> {
    const c = this.eliminarComercio();
    if (!c) return;
    this.guardando.set(true);
    this.modalError.set('');
    try {
      await firstValueFrom(this.adminApi.eliminarComercio(c._id));
      this.eliminarComercio.set(null);
      await this.cargar();
    } catch {
      this.modalError.set('Error eliminando el comercio.');
    } finally {
      this.guardando.set(false);
    }
  }

  emojiVertical(vertical: string): string {
    return VERTICAL_EMOJI[vertical] ?? '📋';
  }

  iconVertical(vertical: string): string {
    return iconoVertical(vertical);
  }

  labelVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  badgeEstado(estado: string): string {
    const map: Record<string, string> = {
      activo: 'rs-badge--success',
      pendiente: 'rs-badge--warning',
      suspendido: 'rs-badge--error',
    };
    return map[estado] ?? 'rs-badge--neutral';
  }
}
