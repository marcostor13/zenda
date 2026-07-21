import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApiService, UsuarioAdmin, CrearUsuarioDto, ActualizarUsuarioDto } from './admin-api.service';

const ROL_BADGE: Record<string, string> = {
  cliente: 'rs-badge--neutral',
  comercio_admin: 'rs-badge--accent',
  comercio_staff: 'rs-badge--accent',
  admin: 'rs-badge--error',
};

const ROL_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  comercio_admin: 'Admin comercio',
  comercio_staff: 'Staff comercio',
  admin: 'Admin plataforma',
};

const FILTROS_ROL = [
  { label: 'Todos', valor: '' },
  { label: 'Clientes', valor: 'cliente' },
  { label: 'Admin comercio', valor: 'comercio_admin' },
  { label: 'Admins', valor: 'admin' },
] as const;

const LIMITE = 20;

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  template: `
    <!-- Cabecera -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Usuarios</h1>
        <p class="page-sub">Usuarios registrados en la plataforma.</p>
      </div>
      <div style="display:flex;gap:var(--sp-3);align-items:center;flex-wrap:wrap">
        <div class="page-kpi rs-card">
          <span class="kpi-num">{{ total() }}</span>
          <span class="kpi-lbl">{{ filtroRol() || 'total' }}</span>
        </div>
        <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="abrirCrear()">+ Nuevo usuario</button>
      </div>
    </div>

    <!-- Barra de filtros + búsqueda -->
    <div class="toolbar">
      <div class="filter-bar">
        @for (f of filtros; track f.valor) {
          <button
            class="rs-btn rs-btn--sm"
            [class.rs-btn--primary]="filtroRol() === f.valor"
            [class.rs-btn--ghost]="filtroRol() !== f.valor"
            (click)="setFiltro(f.valor)">
            {{ f.label }}
          </button>
        }
      </div>
      <input
        class="rs-inp search-input"
        type="text"
        placeholder="Buscar por nombre o email…"
        [value]="buscar()"
        (input)="onBuscar($event)" />
    </div>

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ errorMsg() }}</div>
    }

    <!-- Tabla -->
    <div class="rs-card" style="padding:0;overflow:hidden">
      <div class="tbl-head">
        <span>Usuario</span>
        <span>Email</span>
        <span>Rol</span>
        <span>Verificado</span>
        <span>Registro</span>
        <span>Acciones</span>
      </div>

      @if (cargando()) {
        @for (i of [1,2,3,4,5]; track i) {
          <div class="tbl-row tbl-skeleton">
            <div class="skel skel--lg"></div>
            <div class="skel skel--xl"></div>
            <div class="skel skel--md"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--sm"></div>
            <div class="skel skel--md"></div>
          </div>
        }
      } @else {
        @for (u of usuarios(); track u._id) {
          <div class="tbl-row">
            <div class="usuario-cell">
              <div class="avatar">{{ u.nombre[0]?.toUpperCase() ?? 'U' }}</div>
              <span class="cell-primary">{{ u.nombre }}</span>
            </div>
            <span class="cell-email">{{ u.email }}</span>
            <span>
              <span class="rs-badge {{ badgeRol(u.rol) }}">{{ labelRol(u.rol) }}</span>
            </span>
            <span>
              @if (u.verificado) {
                <span class="rs-badge rs-badge--success">✓ Verificado</span>
              } @else {
                <span class="rs-badge rs-badge--neutral">Pendiente</span>
              }
            </span>
            <span class="cell-muted">{{ u.createdAt | date:'d MMM yyyy' }}</span>
            <div class="acciones">
              <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="abrirEditar(u)">✏️ Editar</button>
              <button class="rs-btn rs-btn--ghost rs-btn--sm" style="color:#F87171"
                (click)="confirmarEliminar(u)">🗑️</button>
            </div>
          </div>
        }
        @if (usuarios().length === 0) {
          <div class="empty-state">
            <span class="empty-icon">👥</span>
            <p>No hay usuarios{{ filtroRol() ? ' con rol "' + filtroRol() + '"' : '' }}</p>
          </div>
        }
      }
    </div>

    <!-- Paginación -->
    @if (totalPaginas() > 1) {
      <div class="pagination">
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() <= 1" (click)="cambiarPagina(paginaActual() - 1)">← Anterior</button>
        <span class="page-info">Página {{ paginaActual() }} de {{ totalPaginas() }} · {{ total() }} usuarios</span>
        <button class="rs-btn rs-btn--secondary rs-btn--sm"
          [disabled]="paginaActual() >= totalPaginas()" (click)="cambiarPagina(paginaActual() + 1)">Siguiente →</button>
      </div>
    }

<!-- MODAL CREAR / EDITAR -->
@if (modalVisible()) {
  <div class="overlay" (click)="cerrarModal()">
    <div class="modal rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">{{ editandoId() ? 'Editar usuario' : 'Nuevo usuario' }}</h2>

      <form [formGroup]="form" (ngSubmit)="guardar()">
        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">Nombre *</label>
            <input formControlName="nombre" class="rs-input" placeholder="Juan Pérez" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Email *</label>
            <input formControlName="email" type="email" class="rs-input" placeholder="juan@example.com" />
          </div>
        </div>

        @if (!editandoId()) {
          <div class="rs-form-group">
            <label class="rs-label">Contraseña *</label>
            <input formControlName="password" type="password" class="rs-input" placeholder="Mínimo 6 caracteres" />
          </div>
        }

        <div class="form-row">
          <div class="rs-form-group">
            <label class="rs-label">Teléfono</label>
            <input formControlName="telefono" class="rs-input" placeholder="+51 999 999 999" />
          </div>
          <div class="rs-form-group">
            <label class="rs-label">Rol</label>
            <select formControlName="rol" class="rs-input">
              <option value="cliente">Cliente</option>
              <option value="comercio_admin">Admin comercio</option>
              <option value="comercio_staff">Staff comercio</option>
              <option value="admin">Admin plataforma</option>
            </select>
          </div>
        </div>

        @if (esRolComercio()) {
          <div class="rs-form-group">
            <label class="rs-label">Comercio asociado</label>
            <select formControlName="comercioId" class="rs-input">
              <option value="">— Selecciona un comercio —</option>
              @for (c of comercios(); track c._id) {
                <option [value]="c._id">{{ c.nombreComercial }}</option>
              }
            </select>
            <p class="rs-field-hint" style="font-size:var(--f-xs);color:var(--t-400);margin-top:var(--sp-1)">
              Obligatorio para cuentas de comercio; sin él no podrán ver sus listados ni reservas.
            </p>
          </div>
        }

        @if (editandoId()) {
          <div class="rs-form-group">
            <label class="check-item" style="cursor:pointer">
              <input type="checkbox" formControlName="verificado" style="accent-color:var(--c-accent);width:16px;height:16px" />
              <span style="font-size:var(--f-sm);color:var(--t-200)">Cuenta verificada</span>
            </label>
          </div>
        }

        @if (modalError()) {
          <div class="rs-alert rs-alert--error" style="margin-bottom:var(--sp-4)">{{ modalError() }}</div>
        }

        <div class="modal-actions">
          <button type="button" class="rs-btn rs-btn--ghost" (click)="cerrarModal()">Cancelar</button>
          <button type="submit" class="rs-btn rs-btn--primary" [disabled]="form.invalid || guardando()">
            {{ guardando() ? 'Guardando…' : (editandoId() ? 'Guardar cambios' : 'Crear usuario') }}
          </button>
        </div>
      </form>
    </div>
  </div>
}

<!-- MODAL CONFIRMAR ELIMINAR -->
@if (eliminarUsuario()) {
  <div class="overlay" (click)="cancelarEliminar()">
    <div class="modal modal--sm rs-card" (click)="$event.stopPropagation()">
      <h2 class="modal-title">Eliminar usuario</h2>
      <p style="color:var(--t-300);margin-bottom:var(--sp-5)">
        ¿Estás seguro de que quieres eliminar a
        <strong style="color:var(--t-100)">{{ eliminarUsuario()!.nombre }}</strong>
        ({{ eliminarUsuario()!.email }})?
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
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .page-kpi { padding: var(--sp-4) var(--sp-6); text-align: center; min-width: 100px; }
    .kpi-num { display: block; font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-lbl { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .toolbar { display: flex; gap: var(--sp-4); margin-bottom: var(--sp-5); flex-wrap: wrap; align-items: center; }
    .filter-bar { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 240px; max-width: 360px; }

    .tbl-head { display: grid; grid-template-columns: 1.2fr 1.4fr 160px 130px 120px 160px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); background: var(--c-raised); }
    .tbl-row { display: grid; grid-template-columns: 1.2fr 1.4fr 160px 130px 120px 160px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); transition: background .15s; }
    .tbl-row:last-child { border: none; }
    .tbl-row:hover { background: var(--c-raised); }
    .tbl-skeleton { pointer-events: none; }

    .usuario-cell { display: flex; align-items: center; gap: var(--sp-3); }
    .avatar { width: 32px; height: 32px; border-radius: var(--r-full); background: var(--c-accent-lo); border: 1px solid var(--b-a); display: flex; align-items: center; justify-content: center; font-size: var(--f-xs); font-weight: var(--w-7); color: var(--c-accent); flex-shrink: 0; }
    .cell-primary { font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); }
    .cell-email { font-size: var(--f-sm); color: var(--t-300); word-break: break-all; }
    .cell-muted { font-size: var(--f-xs); color: var(--t-400); }
    .acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center; }

    .skel { background: var(--c-raised); border-radius: var(--r-sm); height: 14px; animation: pulse 1.4s ease-in-out infinite; }
    .skel--sm { width: 80px; } .skel--md { width: 120px; } .skel--lg { width: 150px; } .skel--xl { width: 200px; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

    .empty-state { padding: var(--sp-16); text-align: center; color: var(--t-400); }
    .empty-icon { font-size: 2.5rem; display: block; margin-bottom: var(--sp-3); }

    .pagination { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); margin-top: var(--sp-6); }
    .page-info { font-size: var(--f-sm); color: var(--t-400); }

    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--sp-4); }
    .modal { width: 100%; max-width: 580px; padding: var(--sp-8); max-height: 90vh; overflow-y: auto; }
    .modal--sm { max-width: 420px; }
    .modal-title { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-6); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
    @media (max-width: 540px) { .form-row { grid-template-columns: 1fr; } }
    .modal-actions { display: flex; gap: var(--sp-3); justify-content: flex-end; margin-top: var(--sp-6); }
  `],
})
export class AdminUsuariosComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly buscarSubject = new Subject<string>();

  readonly cargando = signal(true);
  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly total = signal(0);
  readonly paginaActual = signal(1);
  readonly filtroRol = signal('');
  readonly buscar = signal('');
  readonly errorMsg = signal('');

  readonly modalVisible = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly modalError = signal('');
  readonly eliminarUsuario = signal<UsuarioAdmin | null>(null);

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / LIMITE)));
  readonly filtros = FILTROS_ROL;

  readonly form = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.minLength(6)],
    telefono: [''],
    rol: ['cliente'],
    comercioId: [''],
    verificado: [false],
  });

  readonly comercios = signal<Array<{ _id: string; nombreComercial: string }>>([]);

  esRolComercio(): boolean {
    const rol = this.form.controls.rol.value;
    return rol === 'comercio_admin' || rol === 'comercio_staff';
  }

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
    try {
      const res = await firstValueFrom(this.adminApi.getComercios({ limite: 200 }));
      this.comercios.set(res.items.map((c) => ({ _id: c._id, nombreComercial: c.nombreComercial })));
    } catch {
      // Sin lista de comercios no se puede vincular, pero no bloquea el resto.
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set('');
    try {
      const result = await firstValueFrom(this.adminApi.getUsuarios({
        page: this.paginaActual(),
        limite: LIMITE,
        rol: this.filtroRol() || undefined,
        buscar: this.buscar() || undefined,
      }));
      this.usuarios.set(result.items);
      this.total.set(result.total);
    } catch {
      this.errorMsg.set('Error cargando los usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  async setFiltro(rol: string): Promise<void> {
    this.filtroRol.set(rol);
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

  abrirCrear(): void {
    this.editandoId.set(null);
    this.form.reset({ rol: 'cliente', verificado: false });
    this.form.get('password')!.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')!.updateValueAndValidity();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  abrirEditar(u: UsuarioAdmin): void {
    this.editandoId.set(u._id);
    this.form.patchValue({
      nombre: u.nombre,
      email: u.email,
      telefono: u.telefono ?? '',
      rol: u.rol,
      comercioId: u.comercioId ?? '',
      verificado: u.verificado,
    });
    this.form.get('password')!.clearValidators();
    this.form.get('password')!.updateValueAndValidity();
    this.modalError.set('');
    this.modalVisible.set(true);
  }

  cerrarModal(): void {
    this.modalVisible.set(false);
    this.editandoId.set(null);
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.modalError.set('');
    const v = this.form.value;
    try {
      const comercioId = this.esRolComercio() ? (v.comercioId || undefined) : undefined;
      if (this.esRolComercio() && !comercioId) {
        this.modalError.set('Selecciona el comercio asociado para una cuenta de comercio.');
        this.guardando.set(false);
        return;
      }
      if (this.editandoId()) {
        const dto: ActualizarUsuarioDto = {
          nombre: v.nombre!,
          email: v.email!,
          telefono: v.telefono || undefined,
          rol: v.rol!,
          verificado: v.verificado ?? false,
          comercioId,
        };
        await firstValueFrom(this.adminApi.actualizarUsuario(this.editandoId()!, dto));
      } else {
        const dto: CrearUsuarioDto = {
          nombre: v.nombre!,
          email: v.email!,
          password: v.password!,
          telefono: v.telefono || undefined,
          rol: v.rol!,
          comercioId,
        };
        await firstValueFrom(this.adminApi.crearUsuario(dto));
      }
      this.cerrarModal();
      await this.cargar();
    } catch {
      this.modalError.set('Error guardando el usuario. Verifica que el email no esté en uso.');
    } finally {
      this.guardando.set(false);
    }
  }

  confirmarEliminar(u: UsuarioAdmin): void {
    this.eliminarUsuario.set(u);
    this.modalError.set('');
  }

  cancelarEliminar(): void {
    this.eliminarUsuario.set(null);
  }

  async ejecutarEliminar(): Promise<void> {
    const u = this.eliminarUsuario();
    if (!u) return;
    this.guardando.set(true);
    this.modalError.set('');
    try {
      await firstValueFrom(this.adminApi.eliminarUsuario(u._id));
      this.eliminarUsuario.set(null);
      await this.cargar();
    } catch {
      this.modalError.set('Error eliminando el usuario.');
    } finally {
      this.guardando.set(false);
    }
  }

  badgeRol(rol: string): string { return ROL_BADGE[rol] ?? 'rs-badge--neutral'; }
  labelRol(rol: string): string { return ROL_LABEL[rol] ?? rol; }
}
