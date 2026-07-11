import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiServicio, EspacioDisponibilidad } from './comercio-api.service';
import { iconoVertical } from './vertical-icon';

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
        <h1 class="page-title">Mis listados</h1>
        <p class="page-sub">Gestiona tus servicios publicados y borradores</p>
      </div>
      <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">
        <rs-icon name="plus" [size]="15" [stroke]="2"></rs-icon>
        Nuevo listado
      </a>
    </div>

    @if (cargando()) {
      <div class="skeleton-list">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton-card"></div>
        }
      </div>
    } @else if (servicios().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="tag" [size]="40" [stroke]="1.25" style="color:var(--t-400)"></rs-icon>
        <p>Aún no tienes listados.</p>
        <a routerLink="/comercio/listados/nuevo" class="rs-btn rs-btn--primary rs-btn--sm">
          <rs-icon name="plus" [size]="14" [stroke]="2"></rs-icon>
          Crear primer listado
        </a>
      </div>
    } @else {
      <div class="listados-list">
        @for (s of servicios(); track s._id) {
          <div class="listado-card rs-card">
            <div class="listado-card__img">
              <rs-icon [name]="iconVertical(s.vertical)" [size]="22" [stroke]="1.75"></rs-icon>
            </div>

            <div class="listado-card__info">
              <div class="listado-card__titulo">{{ s.titulo }}</div>
              <div class="listado-card__meta">
                <span class="rs-badge rs-badge--neutral">{{ s.vertical }}</span>
                <span class="listado-card__precio">€{{ s.precioBase | number:'1.0-0' }}</span>
                @if (s.ratingPromedio) {
                  <span class="rs-badge rs-badge--accent">
                    <rs-icon name="star" [size]="10" [stroke]="2"></rs-icon>
                    {{ s.ratingPromedio | number:'1.1-1' }}
                  </span>
                }
              </div>
            </div>

            <div class="listado-card__estado">
              <span class="rs-badge {{ estadoBadge(s.estado) }}">{{ s.estado }}</span>
            </div>

            <div class="listado-card__actions">
              <a class="rs-btn rs-btn--ghost rs-btn--sm" [routerLink]="['/comercio/listados', s._id, 'editar']">
                <rs-icon name="pencil" [size]="13" [stroke]="2"></rs-icon> Editar
              </a>
              <button
                class="rs-btn rs-btn--ghost rs-btn--sm"
                [disabled]="toggling() === s._id"
                (click)="toggleEstado(s)">
                @if (toggling() === s._id) {
                  <rs-icon name="sparkles" [size]="13" [stroke]="2"></rs-icon>
                } @else if (s.estado === 'publicado') {
                  <rs-icon name="pause" [size]="13" [stroke]="2"></rs-icon> Pausar
                } @else {
                  <rs-icon name="play" [size]="13" [stroke]="2"></rs-icon> Publicar
                }
              </button>
              <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="toggleDisponibilidad(s)">
                <rs-icon name="settings" [size]="13" [stroke]="2"></rs-icon> Disponibilidad
              </button>
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
                    <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="quitarEspacio($index)">✕</button>
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

    .empty-state {
      padding: var(--sp-16); text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-4);
      p { color: var(--t-400); font-size: var(--f-md); }
    }

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

  iconVertical(v: string): string { return iconoVertical(v); }

  estadoBadge(estado: string): string {
    if (estado === 'publicado') return 'rs-badge--success';
    if (estado === 'pausado') return 'rs-badge--warning';
    return 'rs-badge--neutral';
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
