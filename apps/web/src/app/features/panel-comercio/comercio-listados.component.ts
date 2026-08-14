import { Component, signal, computed, inject, HostListener, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiServicio, EspacioDisponibilidad } from './comercio-api.service';
import { iconoVertical } from './vertical-icon';
import { verticalUi, enlaceAServicio } from '../../shared/verticales/verticales.config';

type FiltroEstadoServicio = 'todos' | 'publicado' | 'borrador' | 'pausado';

const FILTROS_ESTADO: ReadonlyArray<{ valor: FiltroEstadoServicio; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'publicado', label: 'Publicados' },
  { valor: 'borrador', label: 'Borradores' },
  { valor: 'pausado', label: 'Pausados' },
];

const ESTADO_LABEL: Record<string, string> = {
  publicado: 'Publicado', borrador: 'Borrador', pausado: 'Pausado',
};

/** Campo de disponibilidad (número simple) que corresponde a cada vertical no-alojamiento. */
const CAMPO_DISPONIBILIDAD: Record<string, 'unidadesDisponibles' | 'citasDisponibles' | 'cuposDisponibles'> = {
  transporte: 'unidadesDisponibles',
  veterinaria: 'citasDisponibles',
  peluqueria: 'cuposDisponibles',
  adiestramiento: 'cuposDisponibles',
};

@Component({
  selector: 'app-comercio-listados',
  standalone: true,
  imports: [RouterLink, DecimalPipe, ReactiveFormsModule, RsIconComponent],
  template: `
    <!-- HEADER -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Mis servicios</h1>
        <p class="page-sub">Crea, publica y gestiona los servicios que ofreces en Doogking.</p>
      </div>
      <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary">
        <rs-icon name="plus" [size]="15" [stroke]="2.5"></rs-icon>
        Nuevo servicio
      </a>
    </div>

    @if (!cargando() && servicios().length > 0) {
      <!-- Estados con contador (TCK-8022) -->
      <div class="filter-pills">
        @for (f of filtros; track f.valor) {
          <button class="filter-pill" [class.active]="filtroEstado() === f.valor"
                  (click)="filtroEstado.set(f.valor)">
            {{ f.label }}
            <span class="filter-pill__count">{{ contarEstado(f.valor) }}</span>
          </button>
        }
      </div>

      <!-- Buscador y filtro por categoría: sólo cuando hay varios servicios -->
      @if (servicios().length > 1) {
        <div class="controles">
          <label class="buscador">
            <rs-icon name="search" [size]="15" [stroke]="2"></rs-icon>
            <input class="buscador__input" type="search" placeholder="Buscar un servicio por nombre"
                   [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
          </label>
          @if (categorias().length > 1) {
            <select class="rs-inp control-select" [value]="categoria()"
                    (change)="categoria.set($any($event.target).value)" aria-label="Categoría">
              <option value="">Todas las categorías</option>
              @for (c of categorias(); track c) {
                <option [value]="c">{{ etiquetaVertical(c) }}</option>
              }
            </select>
          }
        </div>
      }
    }

    @if (cargando()) {
      <div class="skeleton-list">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton-card"></div>
        }
      </div>
    } @else if (servicios().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="tag" [size]="40" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>
          Publica tu primer servicio. Configura el servicio, precio, disponibilidad y condiciones
          para empezar a recibir reservas.
        </p>
        <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary">
          <rs-icon name="plus" [size]="15" [stroke]="2.5"></rs-icon>
          Crear mi primer servicio
        </a>
      </div>
    } @else if (serviciosFiltrados().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="search" [size]="36" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>Ningún servicio coincide con la búsqueda.</p>
        <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="limpiarFiltros()">Quitar los filtros</button>
      </div>
    } @else {
      <div class="listados-list">
        @for (s of serviciosFiltrados(); track s._id) {
          <div class="listado-card rs-card">
            <div class="listado-card__img">
              @if (s.imagenes?.length) {
                <img [src]="s.imagenes![0]" [alt]="s.titulo" />
              } @else {
                <rs-icon [name]="iconVertical(s.vertical)" [size]="22" [stroke]="1.75"></rs-icon>
              }
            </div>

            <div class="listado-card__info">
              <div class="listado-card__titulo">{{ s.titulo }}</div>
              <div class="listado-card__meta">
                <span class="rs-badge rs-badge--neutral">{{ etiquetaVertical(s.vertical) }}</span>
                <span class="listado-card__precio">{{ precioDe(s) }}</span>
                @if (s.ratingPromedio) {
                  <span class="rs-badge rs-badge--accent">
                    <rs-icon name="star" [size]="10" [stroke]="2"></rs-icon>
                    {{ s.ratingPromedio | number:'1.1-1' }}
                  </span>
                }
              </div>
              <div class="listado-card__dispo">
                <rs-icon name="calendar" [size]="12" [stroke]="2"></rs-icon>
                {{ resumenDisponibilidad(s) }}
              </div>
            </div>

            <div class="listado-card__estado">
              <span class="rs-badge {{ estadoBadge(s.estado) }}">{{ etiquetaEstado(s.estado) }}</span>
            </div>

            <div class="listado-card__actions">
              <a class="rs-btn rs-btn--ghost rs-btn--sm" [routerLink]="['/comercio/listados', s._id, 'editar']">
                <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon> Editar
              </a>
              <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleDisponibilidad(s)">
                <rs-icon name="settings" [size]="13" [stroke]="2"></rs-icon> Disponibilidad
              </button>
              <a class="rs-btn rs-btn--ghost rs-btn--sm" [routerLink]="enlacePublico(s)">
                <rs-icon name="eye" [size]="13" [stroke]="2"></rs-icon> Ver en Doogking
              </a>
              <div class="mas-opciones" (click)="$event.stopPropagation()">
                <button class="rs-btn rs-btn--ghost rs-btn--sm" aria-label="Más opciones"
                        (click)="menuAbiertoId.set(menuAbiertoId() === s._id ? null : s._id)">
                  <rs-icon name="more-horizontal" [size]="14" [stroke]="2"></rs-icon>
                </button>
                @if (menuAbiertoId() === s._id) {
                  <div class="mas-opciones__menu">
                    <button class="mas-opciones__item" [disabled]="toggling() === s._id"
                            (click)="toggleEstado(s)">
                      @if (s.estado === 'publicado') {
                        <rs-icon name="pause" [size]="13" [stroke]="2"></rs-icon> Pausar servicio
                      } @else {
                        <rs-icon name="play" [size]="13" [stroke]="2"></rs-icon> Publicar servicio
                      }
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>

          @if (disponibilidadAbiertaId() === s._id) {
            <div class="rs-card disponibilidad-panel">
              @if (s.vertical === 'alojamiento') {
                <label class="rs-label">Espacios reservables</label>
                @for (e of espaciosEdit(); track $index) {
                  <div class="espacio-row">
                    <input class="rs-input" type="number" min="0" [value]="e.cantidad"
                           (input)="actualizarEspacio($index, 'cantidad', $any($event.target).value)"
                           placeholder="Cantidad" />
                    <input class="rs-input" type="number" min="0" step="0.01" [value]="e.precioNoche"
                           (input)="actualizarEspacio($index, 'precioNoche', $any($event.target).value)"
                           placeholder="Precio/noche" />
                    <span class="rs-badge rs-badge--neutral">{{ e.tipo }}</span>
                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarEspacio($index)" aria-label="Quitar espacio">
                  <rs-icon name="x" [size]="13" [stroke]="3"></rs-icon>
                </button>
                  </div>
                }
                <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="agregarEspacio()">
                  + Añadir espacio
                </button>
              } @else {
                <label class="rs-label">{{ labelDisponibilidad(s.vertical) }}</label>
                <input class="rs-input" type="number" min="0" [formControl]="numeroCtrl" style="max-width:160px" />
              }
              @if (disponibilidadError()) {
                <p class="rs-field-error">{{ disponibilidadError() }}</p>
              }
              <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-4)">
                <button class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="guardandoDisponibilidad()"
                        (click)="guardarDisponibilidad(s)">
                  {{ guardandoDisponibilidad() ? 'Guardando…' : 'Guardar disponibilidad' }}
                </button>
                <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarDisponibilidad()">Cancelar</button>
              </div>
            </div>
          }
        }
      </div>
    }

    @if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    }
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    .skeleton-list { display: flex; flex-direction: column; gap: var(--sp-4); }
    .skeleton-card {
      height: 80px;
      background: linear-gradient(90deg, var(--c-raised) 25%, var(--c-surface) 50%, var(--c-raised) 75%);
      background-size: 200% 100%;
      border-radius: var(--r-xl);
      animation: shimmer 1.5s infinite;
    }

    /* Estado vacío compacto: el aire sobrante restaba peso al botón (TCK-8022) */
    .empty-state {
      padding: var(--sp-10) var(--sp-8); text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-4);
      p { color: var(--t-400); font-size: var(--f-md); max-width: 48ch; line-height: 1.6; }
    }

    .filter-pills { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .filter-pill {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4); border-radius: var(--r-full);
      border: 1px solid var(--b-2); background: var(--c-raised);
      color: var(--t-300); font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      &:hover { border-color: var(--c-accent); color: var(--c-accent); }
      &.active { background: var(--c-accent-lo); border-color: var(--c-accent); color: var(--c-accent); font-weight: var(--w-6); }
    }
    .filter-pill__count {
      background: var(--c-surface); border-radius: var(--r-full);
      padding: 1px var(--sp-2); font-size: var(--f-xs); color: var(--t-400);
    }

    .controles { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; }
    .buscador {
      display: flex; align-items: center; gap: var(--sp-2);
      flex: 1; min-width: 240px; padding: 0 var(--sp-3); height: 40px;
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-lg);
      color: var(--t-400);
      &:focus-within { border-color: var(--c-accent); }
    }
    .buscador__input {
      flex: 1; border: none; background: transparent; outline: none;
      font-size: var(--f-sm); color: var(--t-100); min-width: 0;
    }
    .control-select { height: 40px; }

    .listados-list { display: flex; flex-direction: column; gap: var(--sp-3); }

    .listado-card {
      display: grid;
      grid-template-columns: 64px 1fr auto auto;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5);
      @media (max-width: 640px) { grid-template-columns: 48px 1fr; grid-template-rows: auto auto; }
    }

    .listado-card__img {
      width: 64px; height: 56px;
      background: var(--c-accent-lo);
      color: var(--c-accent);
      border-radius: var(--r-lg);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .listado-card__dispo {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-2); font-size: var(--f-xs); color: var(--t-400);
    }

    .mas-opciones { position: relative; }
    .mas-opciones__menu {
      position: absolute; right: 0; top: calc(100% + 4px); z-index: var(--z-2);
      min-width: 190px; padding: var(--sp-2);
      background: var(--c-card); border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--shadow-lg, 0 12px 32px rgba(8,37,139,.12));
    }
    .mas-opciones__item {
      display: flex; align-items: center; gap: var(--sp-2); width: 100%;
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent;
      border-radius: var(--r-md); cursor: pointer; text-align: left;
      font-size: var(--f-sm); color: var(--t-200);
      &:hover { background: var(--c-raised); }
    }

    .listado-card__info { min-width: 0; }
    .listado-card__titulo {
      font-size: var(--f-md); font-weight: var(--w-6); color: var(--t-100);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: var(--sp-2);
    }
    .listado-card__meta { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
    .listado-card__precio { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--c-accent); }
    .listado-card__estado { @media (max-width: 640px) { display: none; } }
    .listado-card__actions { display: flex; flex-direction: column; gap: var(--sp-2); @media (max-width: 640px) { grid-column: 2; } }

    .disponibilidad-panel { padding: var(--sp-5); margin-top: calc(-1 * var(--sp-2)); }
    .espacio-row { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-2); }
    .espacio-row .rs-input { max-width: 140px; }
  `],
})
export class ComercioListadosComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly toggling = signal<string | null>(null);
  readonly servicios = signal<MiServicio[]>([]);

  /** Estados, buscador y categoría del listado de servicios (TCK-8022). */
  readonly filtros = FILTROS_ESTADO;
  readonly filtroEstado = signal<FiltroEstadoServicio>('todos');
  readonly busqueda = signal('');
  readonly categoria = signal('');
  readonly menuAbiertoId = signal<string | null>(null);

  readonly categorias = computed(() => [...new Set(this.servicios().map((s) => s.vertical))].sort());

  readonly serviciosFiltrados = computed(() => {
    const estado = this.filtroEstado();
    const texto = this.busqueda().trim().toLowerCase();
    const categoria = this.categoria();
    return this.servicios().filter((s) => {
      if (estado !== 'todos' && s.estado !== estado) return false;
      if (categoria && s.vertical !== categoria) return false;
      if (texto && !s.titulo.toLowerCase().includes(texto)) return false;
      return true;
    });
  });

  readonly disponibilidadAbiertaId = signal<string | null>(null);
  readonly guardandoDisponibilidad = signal(false);
  readonly disponibilidadError = signal('');
  readonly espaciosEdit = signal<EspacioDisponibilidad[]>([]);
  readonly numeroCtrl = new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] });

  async ngOnInit(): Promise<void> {
    try {
      this.servicios.set(await firstValueFrom(this.comercioApi.getMisServicios()));
    } catch {
      this.errorMsg.set('Error al cargar los listados. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** El menú ⋯ se cierra al pulsar fuera, como cualquier desplegable del panel. */
  @HostListener('document:click')
  cerrarMenu(): void {
    this.menuAbiertoId.set(null);
  }

  iconVertical(v: string): string { return iconoVertical(v); }
  etiquetaVertical(v: string): string { return verticalUi(v).label; }
  enlacePublico(s: MiServicio): unknown[] { return enlaceAServicio(s.vertical, s._id); }

  estadoBadge(estado: string): string {
    if (estado === 'publicado') return 'rs-badge--success';
    if (estado === 'pausado') return 'rs-badge--warning';
    return 'rs-badge--neutral';
  }

  etiquetaEstado(estado: string): string {
    return ESTADO_LABEL[estado] ?? estado;
  }

  contarEstado(filtro: FiltroEstadoServicio): number {
    if (filtro === 'todos') return this.servicios().length;
    return this.servicios().filter((s) => s.estado === filtro).length;
  }

  limpiarFiltros(): void {
    this.filtroEstado.set('todos');
    this.busqueda.set('');
    this.categoria.set('');
  }

  /** El precio se lee distinto según cómo se venda el servicio (TCK-8022 §11). */
  precioDe(s: MiServicio): string {
    const importe = `€${Math.round(s.precioBase)}`;
    if (s.vertical === 'alojamiento' || s.vertical === 'hoteles') return `${importe} / noche`;
    if (s.vertical === 'transporte') return `${importe} base`;
    if (s.vertical === 'adiestramiento') return `${importe} / sesión`;
    return `${importe} / cita`;
  }

  /** Disponibilidad publicada, en los términos del vertical (TCK-8022 §9 y §11). */
  resumenDisponibilidad(s: MiServicio): string {
    if (s.vertical === 'alojamiento' || s.vertical === 'hoteles') {
      const espacios = s.espacios ?? [];
      if (!espacios.length) return 'Sin espacios configurados';
      const plazas = espacios.reduce((total, e) => total + (e.cantidad ?? 0), 0);
      return `${espacios.length} tipo${espacios.length === 1 ? '' : 's'} de espacio · ${plazas} plaza${plazas === 1 ? '' : 's'}`;
    }
    const campo = CAMPO_DISPONIBILIDAD[s.vertical];
    const valor = campo ? s[campo] : undefined;
    if (valor === undefined || valor === null) return 'Sin disponibilidad configurada';
    if (s.vertical === 'transporte') return `${valor} unidad${valor === 1 ? '' : 'es'} disponible${valor === 1 ? '' : 's'}`;
    if (s.vertical === 'veterinaria') return `${valor} cita${valor === 1 ? '' : 's'} disponible${valor === 1 ? '' : 's'}`;
    return `${valor} cupo${valor === 1 ? '' : 's'} disponible${valor === 1 ? '' : 's'}`;
  }

  async toggleEstado(servicio: MiServicio): Promise<void> {
    const nuevoEstado = servicio.estado === 'publicado' ? 'pausado' : 'publicado';
    this.toggling.set(servicio._id);
    try {
      const actualizado = await firstValueFrom(this.comercioApi.cambiarEstadoServicio(servicio._id, nuevoEstado));
      this.servicios.update(list => list.map(s => s._id === servicio._id ? { ...s, estado: actualizado.estado } : s));
    } catch {
      this.errorMsg.set('Error al cambiar el estado del listado.');
      setTimeout(() => this.errorMsg.set(''), 3000);
    } finally {
      this.toggling.set(null);
    }
  }

  labelDisponibilidad(vertical: string): string {
    const labels: Record<string, string> = {
      transporte: 'Unidades (vehículos) disponibles',
      veterinaria: 'Citas disponibles',
      peluqueria: 'Cupos disponibles',
      adiestramiento: 'Cupos disponibles',
    };
    return labels[vertical] ?? 'Disponibilidad';
  }

  toggleDisponibilidad(servicio: MiServicio): void {
    if (this.disponibilidadAbiertaId() === servicio._id) {
      this.cerrarDisponibilidad();
      return;
    }
    this.disponibilidadAbiertaId.set(servicio._id);
    this.disponibilidadError.set('');
    this.espaciosEdit.set(servicio.espacios ? servicio.espacios.map((e) => ({ ...e })) : []);
    const campo = CAMPO_DISPONIBILIDAD[servicio.vertical];
    this.numeroCtrl.setValue(campo ? (servicio[campo] ?? 0) : 0);
  }

  cerrarDisponibilidad(): void {
    this.disponibilidadAbiertaId.set(null);
  }

  agregarEspacio(): void {
    this.espaciosEdit.update((lista) => [
      ...lista,
      { tipo: 'estandar', tamanoMaxPerro: 'mediano', precioNoche: 0, cantidad: 1, disponible: true },
    ]);
  }

  quitarEspacio(index: number): void {
    this.espaciosEdit.update((lista) => lista.filter((_, i) => i !== index));
  }

  actualizarEspacio(index: number, campo: 'cantidad' | 'precioNoche', valor: string): void {
    const numero = Number(valor);
    this.espaciosEdit.update((lista) =>
      lista.map((e, i) => (i === index ? { ...e, [campo]: Number.isFinite(numero) ? numero : 0 } : e)),
    );
  }

  async guardarDisponibilidad(servicio: MiServicio): Promise<void> {
    this.disponibilidadError.set('');
    const payload: Record<string, unknown> =
      servicio.vertical === 'alojamiento'
        ? { espacios: this.espaciosEdit() }
        : { [CAMPO_DISPONIBILIDAD[servicio.vertical]]: this.numeroCtrl.value };

    this.guardandoDisponibilidad.set(true);
    try {
      const actualizado = await firstValueFrom(this.comercioApi.actualizarDisponibilidad(servicio._id, payload));
      this.servicios.update((lista) =>
        lista.map((s) => (s._id === servicio._id ? { ...s, ...actualizado } : s)),
      );
      this.cerrarDisponibilidad();
    } catch {
      this.disponibilidadError.set('No se pudo guardar la disponibilidad. Inténtalo de nuevo.');
    } finally {
      this.guardandoDisponibilidad.set(false);
    }
  }
}
