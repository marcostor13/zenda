import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { hotelImage } from '../../../shared/media/images';

type EstadoFiltro = 'todas' | 'confirmada' | 'pendiente' | 'cancelada' | 'completada';

interface ReservaCard {
  codigo: string;
  vertical: string;
  emoji: string;
  titulo: string;
  subtitulo: string;
  imagen: string;
  fechaInicio: string;
  fechaFin: string;
  total: number;
  estado: 'confirmada' | 'pendiente' | 'cancelada' | 'completada';
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [RouterLink, RsNavbarComponent, ImgFallbackDirective],
  template: `
<div style="min-height:100vh;background:var(--c-base)">
  <rs-navbar />

  <div class="rs-wrap" style="padding-block:var(--sp-10)">

    <div style="margin-bottom:var(--sp-8)">
      <h1 style="font-size:var(--f-3xl);font-weight:var(--w-9);color:var(--t-100);margin-bottom:var(--sp-2)">Mis reservas</h1>
      <p style="color:var(--t-400)">Gestiona y consulta todas tus reservas</p>
    </div>

    <!-- FILTROS -->
    <div class="filtros-bar">
      @for (f of filtros; track f.valor) {
        <button class="filtro-pill"
                [class.active]="filtroActivo() === f.valor"
                (click)="filtroActivo.set(f.valor)">
          {{ f.label }}
          <span class="filtro-pill__count">{{ conteo(f.valor) }}</span>
        </button>
      }
    </div>

    <!-- LISTA -->
    <div class="reservas-list">
      @for (r of reservasFiltradas(); track r.codigo) {
        <div class="reserva-row rs-card rs-card--hover">
          <img [src]="r.imagen" [alt]="r.titulo" class="reserva-row__img" rsImg />

          <div class="reserva-row__info">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2)">
              <span class="rs-badge rs-badge--purple" style="font-size:var(--f-xs)">{{ r.emoji }} {{ r.vertical }}</span>
              <span class="{{ 'rs-badge ' + estadoBadge(r.estado) }}">{{ estadoLabel(r.estado) }}</span>
            </div>
            <h3 class="reserva-row__titulo">{{ r.titulo }}</h3>
            <p class="reserva-row__subtitulo">{{ r.subtitulo }}</p>
            <div class="reserva-row__fechas">
              <span>📅 {{ r.fechaInicio }}</span>
              @if (r.fechaFin !== r.fechaInicio) {
                <span>→ {{ r.fechaFin }}</span>
              }
            </div>
          </div>

          <div class="reserva-row__aside">
            <div class="reserva-row__codigo">{{ r.codigo }}</div>
            <div class="reserva-row__precio">€{{ r.total }}</div>
            <div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-4)">
              <a [routerLink]="['/reservas', r.codigo]" class="rs-btn rs-btn--outline rs-btn--sm">Ver detalle</a>
              @if (r.estado === 'confirmada') {
                <button class="rs-btn rs-btn--danger rs-btn--sm">Cancelar</button>
              }
            </div>
          </div>
        </div>
      }

      @if (reservasFiltradas().length === 0) {
        <div class="empty-state">
          <div style="font-size:3rem;margin-bottom:var(--sp-4)">🔍</div>
          <h3>No hay reservas {{ filtroActivo() !== 'todas' ? 'con este estado' : '' }}</h3>
          <p>Cuando hagas tu primera reserva aparecerá aquí.</p>
          <a routerLink="/hoteles" class="rs-btn rs-btn--primary" style="margin-top:var(--sp-5)">Explorar hoteles</a>
        </div>
      }
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }

    .filtros-bar {
      display: flex;
      gap: var(--sp-2);
      flex-wrap: wrap;
      margin-bottom: var(--sp-6);
    }

    .filtro-pill {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      background: var(--c-raised);
      border: 1px solid var(--b-1);
      border-radius: var(--r-full);
      color: var(--t-300);
      font-size: var(--f-sm);
      cursor: pointer;
      transition: all var(--d-2);

      &.active {
        background: var(--c-accent);
        border-color: var(--c-accent);
        color: #fff;
      }

      &:hover:not(.active) { border-color: var(--b-2); color: var(--t-100); }
    }

    .filtro-pill__count {
      background: rgba(255,255,255,.15);
      border-radius: var(--r-full);
      padding: 1px 7px;
      font-size: var(--f-xs);
    }

    .reservas-list { display: flex; flex-direction: column; gap: var(--sp-4); }

    .reserva-row {
      display: grid;
      grid-template-columns: 160px 1fr auto;
      gap: var(--sp-5);
      padding: var(--sp-5);
      align-items: center;

      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .reserva-row__img {
      width: 160px;
      height: 120px;
      object-fit: cover;
      border-radius: var(--r-lg);

      @media (max-width: 768px) { width: 100%; height: 200px; }
    }

    .reserva-row__titulo { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .reserva-row__subtitulo { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-3); }
    .reserva-row__fechas { font-size: var(--f-sm); color: var(--t-300); display: flex; gap: var(--sp-3); }
    .reserva-row__aside { text-align: right; @media (max-width: 768px) { text-align: left; } }
    .reserva-row__codigo { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-1); font-family: monospace; }
    .reserva-row__precio { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }

    .empty-state { text-align: center; padding: var(--sp-20) var(--sp-8); h3 { font-size: var(--f-xl); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-3); } p { color: var(--t-400); } }
  `],
})
export class MisReservasComponent {
  readonly filtroActivo = signal<EstadoFiltro>('todas');

  readonly filtros: { valor: EstadoFiltro; label: string }[] = [
    { valor: 'todas',      label: 'Todas' },
    { valor: 'confirmada', label: 'Confirmadas' },
    { valor: 'pendiente',  label: 'Pendientes' },
    { valor: 'completada', label: 'Completadas' },
    { valor: 'cancelada',  label: 'Canceladas' },
  ];

  readonly reservas = signal<ReservaCard[]>([
    {
      codigo: 'RES-A1B2C3',
      vertical: 'Hotel',
      emoji: '🏨',
      titulo: 'Gran Hotel Madrid Salamanca',
      subtitulo: 'Habitación Superior · 2 noches',
      imagen: hotelImage(0, 400),
      fechaInicio: '15 Jul 2026',
      fechaFin: '17 Jul 2026',
      total: 756,
      estado: 'confirmada',
    },
    {
      codigo: 'RES-D4E5F6',
      vertical: 'Taxi',
      emoji: '🚗',
      titulo: 'Traslado Aeropuerto Adolfo Suárez',
      subtitulo: 'Madrid → Salamanca · Sedán',
      imagen: hotelImage(7, 400),
      fechaInicio: '14 Jul 2026',
      fechaFin: '14 Jul 2026',
      total: 95,
      estado: 'completada',
    },
    {
      codigo: 'RES-G7H8I9',
      vertical: 'Hotel',
      emoji: '🏨',
      titulo: 'Belmond Madrid',
      subtitulo: 'Suite Deluxe Vista al Mar · 3 noches',
      imagen: hotelImage(8, 400),
      fechaInicio: '20 Ago 2026',
      fechaFin: '23 Ago 2026',
      total: 2124,
      estado: 'pendiente',
    },
  ]);

  readonly reservasFiltradas = () => {
    const f = this.filtroActivo();
    if (f === 'todas') return this.reservas();
    return this.reservas().filter(r => r.estado === f);
  };

  conteo(filtro: EstadoFiltro): number {
    if (filtro === 'todas') return this.reservas().length;
    return this.reservas().filter(r => r.estado === filtro).length;
  }

  estadoBadge(estado: string): string {
    const map: Record<string, string> = {
      confirmada: 'rs-badge--success',
      pendiente:  'rs-badge--warning',
      cancelada:  'rs-badge--danger',
      completada: 'rs-badge--accent',
    };
    return map[estado] ?? '';
  }

  estadoLabel(estado: string): string {
    const map: Record<string, string> = {
      confirmada: '✓ Confirmada',
      pendiente:  '⏳ Pendiente',
      cancelada:  '✗ Cancelada',
      completada: '★ Completada',
    };
    return map[estado] ?? estado;
  }

}
