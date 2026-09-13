import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ImgFallbackDirective } from '../../shared/directives/img-fallback.directive';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';
import { ExpedienteService, MascotaComercioApi } from '../perros/expediente.service';
import { iconoVertical } from './vertical-icon';
import { edadLegible, normalizarBusqueda } from '../perros/edad';
import { I18nService } from '../../core/i18n/i18n.service';

type Filtro = 'todas' | 'sinRegistros' | 'conAlertas';

/**
 * Mascotas del comercio: los perros con ficha en Doogking que han reservado
 * aquí. Es la puerta al expediente de cada uno, donde se anota lo que se hizo
 * en cada servicio y se descarga el informe.
 */
@Component({
  selector: 'app-comercio-mascotas',
  standalone: true,
  imports: [DatePipe, RouterLink, RsIconComponent, ImgFallbackDirective, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="page-header">
  <div>
    <h1 class="page-title">{{ 'Mascotas' | t }}</h1>
    <p class="page-sub">{{ 'Los perros de tus clientes, con la ficha que rellenó su dueño y el historial de lo que les has hecho en cada servicio.' | t }}</p>
  </div>
  <div class="header-kpis">
    <button type="button" class="rs-card kpi-chip" [class.is-activo]="filtro() === 'todas'" (click)="filtro.set('todas')">
      <span class="kpi-chip__value">{{ mascotas().length }}</span>
      <span class="kpi-chip__label">{{ 'Mascotas' | t }}</span>
    </button>
    <button type="button" class="rs-card kpi-chip" [class.is-activo]="filtro() === 'sinRegistros'" (click)="alternar('sinRegistros')">
      <span class="kpi-chip__value">{{ sinRegistros() }}</span>
      <span class="kpi-chip__label">{{ 'Sin historial' | t }}</span>
    </button>
    <button type="button" class="rs-card kpi-chip" [class.is-activo]="filtro() === 'conAlertas'" (click)="alternar('conAlertas')">
      <span class="kpi-chip__value">{{ conAlertas() }}</span>
      <span class="kpi-chip__label">{{ 'Con alertas' | t }}</span>
    </button>
  </div>
</div>

<div class="buscador rs-card">
  <rs-icon name="search" [size]="18" [stroke]="2"></rs-icon>
  <input type="search" class="buscador__input" [value]="busqueda()"
         (input)="busqueda.set($any($event.target).value)"
         [placeholder]="'Buscar por perro, raza o dueño' | t"
         [attr.aria-label]="'Buscar mascotas' | t" />
</div>

@if (cargando()) {
  <div class="mascotas-grid">
    @for (i of [1, 2, 3]; track i) {
      <div class="rs-card mascota-card mascota-card--skel"><div class="skel skel--avatar"></div><div class="skel skel--linea"></div></div>
    }
  </div>
} @else if (error()) {
  <div class="rs-alert rs-alert--error">{{ error() | t }}</div>
} @else if (mascotas().length === 0) {
  <div class="rs-card empty-state">
    <rs-icon name="paw" [size]="40" [stroke]="1.5"></rs-icon>
    <h3>{{ 'Todavía no hay mascotas' | t }}</h3>
    <p>{{ 'Aparecerán aquí cuando un cliente reserve con la ficha de su perro creada en Doogking.' | t }}</p>
  </div>
} @else if (visibles().length === 0) {
  <div class="rs-card empty-state">
    <rs-icon name="search" [size]="36" [stroke]="1.5"></rs-icon>
    <p>{{ 'Ninguna mascota coincide con la búsqueda.' | t }}</p>
  </div>
} @else {
  <div class="mascotas-grid">
    @for (m of visibles(); track m.perroId) {
      <a class="rs-card mascota-card" [routerLink]="['/comercio/mascotas', m.perroId]">
        <div class="mascota-card__top">
          <div class="mascota-card__avatar">
            @if (m.foto) { <img [src]="m.foto" [alt]="m.nombre" rsImg /> }
            @else { <rs-icon name="dog" [size]="26" [stroke]="1.5"></rs-icon> }
          </div>
          <div class="mascota-card__id">
            <h3>{{ m.nombre }}</h3>
            <p>
              {{ m.raza || ('Mestizo' | t) }}
              @if (edad(m); as e) { · {{ e }} }
              @if (m.peso) { · {{ m.peso }} kg }
            </p>
          </div>
          <rs-icon class="mascota-card__flecha" name="chevron-right" [size]="18" [stroke]="2"></rs-icon>
        </div>

        <div class="mascota-card__dueno">
          <rs-icon name="user" [size]="14" [stroke]="2"></rs-icon>
          <span>{{ m.propietario.nombre || ('Cliente' | t) }}</span>
          @if (m.propietario.telefono) {
            <span class="mascota-card__tel">{{ m.propietario.telefono }}</span>
          }
        </div>

        @if (m.alergias.length || m.enfermedades.length || m.tieneMedicacion) {
          <div class="mascota-card__alertas">
            @if (m.alergias.length) {
              <span class="rs-badge rs-badge--error">
                <rs-icon name="alert-triangle" [size]="11" [stroke]="2.5"></rs-icon> {{ 'Alergias' | t }}
              </span>
            }
            @if (m.enfermedades.length) { <span class="rs-badge rs-badge--warning">{{ 'Patologías' | t }}</span> }
            @if (m.tieneMedicacion) {
              <span class="rs-badge rs-badge--warning">
                <rs-icon name="pill" [size]="11" [stroke]="2.5"></rs-icon> {{ 'Medicación' | t }}
              </span>
            }
          </div>
        }

        <div class="mascota-card__pie">
          <span class="mascota-card__verticales">
            @for (v of m.verticales; track v) {
              <rs-icon [name]="icono(v)" [size]="14" [stroke]="2"></rs-icon>
            }
          </span>
          <span>{{ m.serviciosCompletados }} {{ 'servicios' | t }}</span>
          <span>{{ m.totalRegistros }} {{ 'registros' | t }}</span>
          @if (m.ultimoServicio) {
            <span class="mascota-card__fecha">{{ m.ultimoServicio | date:'d MMM yyyy' }}</span>
          }
        </div>
      </a>
    }
  </div>
}
  `,
  styles: [`
    :host { display: contents; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-5); flex-wrap: wrap; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); max-width: 620px; }
    .header-kpis { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
    .kpi-chip {
      padding: var(--sp-3) var(--sp-5); text-align: center; min-width: 88px; cursor: pointer;
      border: 1px solid var(--b-1); font: inherit; display: flex; flex-direction: column;
      &:hover { background: var(--c-raised); }
      &.is-activo { outline: 2px solid var(--c-accent); outline-offset: 2px; }
    }
    .kpi-chip__value { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-chip__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .buscador { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); color: var(--t-400); }
    .buscador__input { flex: 1; border: none; outline: none; background: transparent; font: inherit; font-size: var(--f-base); color: var(--t-100); min-width: 0; }

    .mascotas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: var(--sp-4); }
    .mascota-card {
      display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-5);
      text-decoration: none; color: inherit; transition: transform var(--d-2), box-shadow var(--d-2);
      &:hover { transform: translateY(-2px); box-shadow: var(--sh-lg); }
      &:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
    }
    .mascota-card__top { display: flex; align-items: center; gap: var(--sp-3); }
    .mascota-card__avatar {
      width: 56px; height: 56px; border-radius: var(--r-full); overflow: hidden; flex-shrink: 0;
      background: var(--c-accent-lo); color: var(--c-accent); display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 2px var(--c-card), 0 0 0 4px var(--dk-gold);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .mascota-card__id { flex: 1; min-width: 0; }
    .mascota-card__id h3 { font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); margin: 0; }
    .mascota-card__id p { font-size: var(--f-sm); color: var(--t-400); margin: 2px 0 0; }
    .mascota-card__flecha { color: var(--t-500); }
    .mascota-card__dueno { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-300); flex-wrap: wrap; }
    .mascota-card__tel { color: var(--t-400); font-size: var(--f-xs); }
    .mascota-card__alertas { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .mascota-card__pie {
      display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin-top: auto;
      padding-top: var(--sp-3); border-top: 1px solid var(--b-1); font-size: var(--f-xs); color: var(--t-400);
    }
    .mascota-card__verticales { display: inline-flex; gap: var(--sp-1); color: var(--c-accent); }
    .mascota-card__fecha { margin-left: auto; }

    .empty-state {
      padding: var(--sp-16) var(--sp-6); text-align: center; color: var(--t-400);
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-3);
      h3 { font-size: var(--f-lg); color: var(--t-200); margin: 0; }
      p { max-width: 420px; margin: 0; }
    }
    .mascota-card--skel { min-height: 150px; }
    .skel { background: var(--c-raised); border-radius: var(--r-sm); animation: pulso 1.4s ease-in-out infinite; }
    .skel--avatar { width: 56px; height: 56px; border-radius: var(--r-full); }
    .skel--linea { height: 14px; width: 60%; }
    @keyframes pulso { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  `],
})
export class ComercioMascotasComponent implements OnInit {
  private readonly expedientes = inject(ExpedienteService);
  private readonly i18n = inject(I18nService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mascotas = signal<MascotaComercioApi[]>([]);
  readonly busqueda = signal('');
  readonly filtro = signal<Filtro>('todas');

  readonly sinRegistros = computed(() => this.mascotas().filter((m) => m.totalRegistros === 0).length);
  readonly conAlertas = computed(() => this.mascotas().filter(tieneAlertas).length);

  /** Se filtra en cliente: la lista es por comercio y cabe entera en memoria. */
  readonly visibles = computed(() => {
    const termino = normalizarBusqueda(this.busqueda());
    return this.mascotas()
      .filter((m) => this.filtro() !== 'sinRegistros' || m.totalRegistros === 0)
      .filter((m) => this.filtro() !== 'conAlertas' || tieneAlertas(m))
      .filter((m) => !termino || [m.nombre, m.raza, m.propietario.nombre, m.propietario.email]
        .some((campo) => normalizarBusqueda(campo ?? '').includes(termino)));
  });

  async ngOnInit(): Promise<void> {
    try {
      this.mascotas.set(await this.expedientes.mascotasDelComercio());
    } catch {
      this.error.set('No se pudieron cargar las mascotas. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  alternar(filtro: Filtro): void {
    this.filtro.update((actual) => (actual === filtro ? 'todas' : filtro));
  }

  edad(m: MascotaComercioApi): string | null {
    return edadLegible(m.fechaNacimiento, (texto, params) => this.i18n.t(texto, params));
  }

  icono(vertical: string): string {
    return iconoVertical(vertical);
  }
}

function tieneAlertas(m: MascotaComercioApi): boolean {
  return m.alergias.length > 0 || m.enfermedades.length > 0 || m.tieneMedicacion;
}
