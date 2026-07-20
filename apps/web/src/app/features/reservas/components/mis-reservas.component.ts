import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { alojamientoImage } from '../../../shared/media/images';
import { ReservasService, ReservaApi } from '../services/reservas.service';
import { ReviewsService } from '../services/reviews.service';
import { AlojamientoService } from '../../alojamiento/services/alojamiento.service';
import { AuthService } from '../../../core/auth/auth.service';

type EstadoFiltro = 'todas' | 'confirmada' | 'pendiente' | 'cancelada' | 'completada';

interface ReservaCard {
  id: string;
  codigo: string;
  vertical: string;
  emoji: string;
  titulo: string;
  subtitulo: string;
  imagen: string;
  fechaInicio: string;
  fechaFin: string;
  total: number;
  estado: 'confirmada' | 'pendiente' | 'ajuste_solicitado' | 'cancelada' | 'completada';
  montoAjustado?: number;
  suplementosMotivo?: string;
  yaResenada: boolean;
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsNavbarComponent, ImgFallbackDirective],
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
        @if (r.estado === 'ajuste_solicitado') {
          <div class="rs-card ajuste-banner">
            <div>
              <strong>El comercio solicitó un ajuste de precio</strong>
              <p>{{ r.codigo }} · nuevo total propuesto: €{{ r.montoAjustado }} (antes €{{ r.total }}). Ningún cargo se aplicará sin tu aprobación.</p>
            </div>
            <a [routerLink]="['/reservas', r.codigo, 'ajuste']" class="rs-btn rs-btn--primary rs-btn--sm">Revisar y responder</a>
          </div>
        }

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
              @if (r.estado === 'confirmada' || r.estado === 'pendiente') {
                <button class="rs-btn rs-btn--danger rs-btn--sm"
                        [disabled]="cancelandoId() === r.id"
                        (click)="cancelar(r)">
                  {{ cancelandoId() === r.id ? 'Cancelando…' : 'Cancelar' }}
                </button>
              }
              @if (r.estado === 'completada' && !r.yaResenada && resenandoId() !== r.id) {
                <button class="rs-btn rs-btn--gold rs-btn--sm" (click)="abrirResena(r.id)">Dejar reseña</button>
              }
              @if (r.estado === 'completada' && r.yaResenada) {
                <span class="rs-badge rs-badge--success" style="font-size:var(--f-xs)">✓ Reseñada</span>
              }
            </div>
          </div>
        </div>

        @if (resenandoId() === r.id) {
          <div class="rs-card resena-form">
            <label class="rs-label">Tu puntuación</label>
            <div class="resena-form__estrellas">
              @for (n of [1,2,3,4,5]; track n) {
                <button type="button" class="estrella-btn" [class.activa]="n <= puntuacionSel()" (click)="puntuacionSel.set(n)">★</button>
              }
            </div>
            <label class="rs-label" style="margin-top:var(--sp-3)">Tu comentario</label>
            <textarea class="rs-input" rows="3" [formControl]="comentarioCtrl"
                      placeholder="Cuéntanos cómo fue la experiencia con tu perro…"></textarea>
            @if (errorResena()) {
              <p class="rs-field-error">{{ errorResena() }}</p>
            }
            <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-4)">
              <button class="rs-btn rs-btn--primary rs-btn--sm" [disabled]="enviandoResena()" (click)="enviarResena(r)">
                {{ enviandoResena() ? 'Enviando…' : 'Publicar reseña' }}
              </button>
              <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cerrarResena()">Cancelar</button>
            </div>
          </div>
        }
      }

      @if (reservasFiltradas().length === 0) {
        <div class="empty-state">
          <div style="font-size:3rem;margin-bottom:var(--sp-4)">🔍</div>
          <h3>No hay reservas {{ filtroActivo() !== 'todas' ? 'con este estado' : '' }}</h3>
          <p>Cuando hagas tu primera reserva aparecerá aquí.</p>
          <a routerLink="/alojamiento" class="rs-btn rs-btn--gold" style="margin-top:var(--sp-5)">Explorar alojamientos</a>
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

    .ajuste-banner {
      display: flex; justify-content: space-between; align-items: center; gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5); border-color: var(--c-amber); flex-wrap: wrap;
      strong { color: var(--t-100); font-size: var(--f-sm); }
      p { color: var(--t-400); font-size: var(--f-xs); margin-top: var(--sp-1); }
    }

    .resena-form { margin-top: calc(-1 * var(--sp-2)); padding: var(--sp-5); }
    .resena-form__estrellas { display: flex; gap: var(--sp-1); }
    .estrella-btn {
      background: none; border: none; cursor: pointer; font-size: 1.5rem; color: var(--b-2); line-height: 1;
      &.activa { color: var(--c-amber); }
    }
  `],
})
export class MisReservasComponent implements OnInit {
  private readonly reservasService = inject(ReservasService);
  private readonly alojamientoService = inject(AlojamientoService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly auth = inject(AuthService);

  // ── Cambiar a true para usar datos de ejemplo en lugar del API ──
  private readonly useMock = false;

  private readonly MOCK_RESERVAS: ReservaCard[] = [
    {
      id: 'mock-1',
      codigo: 'RES-A1B2C3',
      vertical: 'Alojamiento canino',
      emoji: '🏠',
      titulo: 'Residencia Canina Villa Perruna',
      subtitulo: 'Suite estándar · 2 noches · 1 perro',
      imagen: alojamientoImage(0, 400),
      fechaInicio: '15 Jul 2026',
      fechaFin: '17 Jul 2026',
      total: 76,
      estado: 'confirmada',
      yaResenada: false,
    },
    {
      id: 'mock-2',
      codigo: 'RES-D4E5F6',
      vertical: 'Transporte de animales',
      emoji: '🚐',
      titulo: 'Traslado canino Madrid Centro',
      subtitulo: 'Madrid → Toledo · Van acondicionada',
      imagen: alojamientoImage(7, 400),
      fechaInicio: '14 Jul 2026',
      fechaFin: '14 Jul 2026',
      total: 45,
      estado: 'completada',
      yaResenada: false,
    },
    {
      id: 'mock-3',
      codigo: 'RES-G7H8I9',
      vertical: 'Peluquerías caninas',
      emoji: '✂️',
      titulo: 'Peluquería Canina Real Grooming',
      subtitulo: 'Baño y corte · Perro mediano',
      imagen: alojamientoImage(8, 400),
      fechaInicio: '20 Ago 2026',
      fechaFin: '20 Ago 2026',
      total: 38,
      estado: 'pendiente',
      yaResenada: false,
    },
  ];

  readonly filtroActivo = signal<EstadoFiltro>('todas');

  readonly filtros: { valor: EstadoFiltro; label: string }[] = [
    { valor: 'todas',      label: 'Todas' },
    { valor: 'confirmada', label: 'Confirmadas' },
    { valor: 'pendiente',  label: 'Pendientes' },
    { valor: 'completada', label: 'Completadas' },
    { valor: 'cancelada',  label: 'Canceladas' },
  ];

  readonly reservas = signal<ReservaCard[]>(this.useMock ? this.MOCK_RESERVAS : []);

  readonly cancelandoId = signal<string | null>(null);

  readonly resenandoId = signal<string | null>(null);
  readonly puntuacionSel = signal(5);
  readonly comentarioCtrl = new FormControl('', { nonNullable: true, validators: [Validators.minLength(3)] });
  readonly enviandoResena = signal(false);
  readonly errorResena = signal('');

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
      ajuste_solicitado: 'rs-badge--warning',
      cancelada:  'rs-badge--danger',
      completada: 'rs-badge--accent',
    };
    return map[estado] ?? '';
  }

  estadoLabel(estado: string): string {
    const map: Record<string, string> = {
      confirmada: '✓ Confirmada',
      pendiente:  '⏳ Pendiente',
      ajuste_solicitado: '⚠ Ajuste pendiente',
      cancelada:  '✗ Cancelada',
      completada: '★ Completada',
    };
    return map[estado] ?? estado;
  }

  async ngOnInit(): Promise<void> {
    if (this.useMock) return;
    try {
      const apiReservas = await this.reservasService.misReservas();
      const resenadasIds = await this.reservaIdsYaResenadas();
      const cards = await Promise.all(apiReservas.map((r) => this.aCard(r, resenadasIds)));
      this.reservas.set(cards);
    } catch {
      // API no disponible — estado vacío.
    }
  }

  /** IDs de reserva que ya tienen una reseña del usuario actual. */
  private async reservaIdsYaResenadas(): Promise<Set<string>> {
    const usuarioId = this.auth.usuario()?.id;
    if (!usuarioId) return new Set();
    try {
      const resenas = await this.reviewsService.misResenas(usuarioId);
      return new Set(resenas.map((r) => r.reservaId));
    } catch {
      return new Set();
    }
  }

  /** Hidrata una reserva del API con el nombre/imagen del servicio (opción b). */
  private async aCard(r: ReservaApi, resenadasIds: Set<string>): Promise<ReservaCard> {
    const meta = this.verticalMeta(r.vertical);
    let titulo = (r.detalle?.['titulo'] as string) ?? meta.label;
    let imagen = (r.detalle?.['imagen'] as string) ?? alojamientoImage(0, 400);

    try {
      const servicio = await this.alojamientoService.obtener(r.servicioId);
      titulo = servicio.nombre;
      imagen = servicio.imagenes?.[0] ?? imagen;
    } catch {
      // Si no se puede hidratar, se usa el título/imagen de respaldo.
    }

    const id = r._id ?? r.id ?? '';
    return {
      id,
      codigo: r.codigo,
      vertical: meta.label,
      emoji: meta.emoji,
      titulo,
      subtitulo: this.subtituloReserva(r),
      imagen,
      fechaInicio: this.formatearFecha(r.fechaInicio),
      fechaFin: this.formatearFecha(r.fechaFin ?? r.fechaInicio),
      total: r.montoTotal,
      estado: this.normalizarEstado(r.estado),
      montoAjustado: r.montoAjustado,
      yaResenada: resenadasIds.has(id),
    };
  }

  private verticalMeta(vertical: string): { label: string; emoji: string } {
    const map: Record<string, { label: string; emoji: string }> = {
      [VerticalKey.ALOJAMIENTO]:    { label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],    emoji: '🏠' },
      [VerticalKey.TRANSPORTE]:     { label: VERTICAL_LABELS[VerticalKey.TRANSPORTE],     emoji: '🚐' },
      [VerticalKey.VETERINARIA]:    { label: VERTICAL_LABELS[VerticalKey.VETERINARIA],    emoji: '🩺' },
      [VerticalKey.PELUQUERIA]:     { label: VERTICAL_LABELS[VerticalKey.PELUQUERIA],     emoji: '✂️' },
      [VerticalKey.ADIESTRAMIENTO]: { label: VERTICAL_LABELS[VerticalKey.ADIESTRAMIENTO], emoji: '🎓' },
      [VerticalKey.HOTELES]:        { label: VERTICAL_LABELS[VerticalKey.HOTELES],        emoji: '🏨' },
    };
    return map[vertical] ?? { label: vertical, emoji: '🐾' };
  }

  /** Línea secundaria de la tarjeta según la lógica de reserva de cada categoría. */
  private subtituloReserva(r: ReservaApi): string {
    switch (r.vertical) {
      case VerticalKey.ALOJAMIENTO:
        return `${r.cantidad} ${r.cantidad === 1 ? 'perro' : 'perros'}`;
      case VerticalKey.TRANSPORTE: {
        const origen = r.detalle?.['origen'];
        const destino = r.detalle?.['destino'];
        return origen && destino ? `${origen} → ${destino}` : 'Trayecto';
      }
      case VerticalKey.VETERINARIA:
      case VerticalKey.PELUQUERIA: {
        const hora = r.detalle?.['hora'];
        return hora ? `Cita · ${hora}` : 'Cita';
      }
      case VerticalKey.ADIESTRAMIENTO:
        return r.detalle?.['modalidad'] === 'programa' ? 'Programa completo' : 'Sesión';
      case VerticalKey.HOTELES:
        return `${r.cantidad} ${r.cantidad === 1 ? 'mascota' : 'mascotas'}`;
      default:
        return `${r.cantidad} ${r.cantidad === 1 ? 'unidad' : 'unidades'}`;
    }
  }

  private normalizarEstado(estado: string): ReservaCard['estado'] {
    const validos: ReservaCard['estado'][] = ['confirmada', 'pendiente', 'ajuste_solicitado', 'cancelada', 'completada'];
    return (validos as string[]).includes(estado) ? (estado as ReservaCard['estado']) : 'pendiente';
  }

  private formatearFecha(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async cancelar(r: ReservaCard): Promise<void> {
    if (!confirm(`¿Cancelar la reserva ${r.codigo}?`)) return;
    this.cancelandoId.set(r.id);
    try {
      await this.reservasService.cancelar(r.id);
      this.reservas.update((lista) =>
        lista.map((x) => (x.id === r.id ? { ...x, estado: 'cancelada' } : x)),
      );
    } catch {
      alert('No se pudo cancelar la reserva. Inténtalo de nuevo.');
    } finally {
      this.cancelandoId.set(null);
    }
  }

  abrirResena(reservaId: string): void {
    this.resenandoId.set(reservaId);
    this.puntuacionSel.set(5);
    this.comentarioCtrl.reset('');
    this.errorResena.set('');
  }

  cerrarResena(): void {
    this.resenandoId.set(null);
  }

  async enviarResena(r: ReservaCard): Promise<void> {
    const comentario = this.comentarioCtrl.value.trim();
    if (comentario.length < 3) {
      this.errorResena.set('Escribe un comentario de al menos 3 caracteres.');
      return;
    }
    this.enviandoResena.set(true);
    this.errorResena.set('');
    try {
      await this.reviewsService.crear({ reservaId: r.id, puntuacion: this.puntuacionSel(), comentario });
      this.reservas.update((lista) =>
        lista.map((x) => (x.id === r.id ? { ...x, yaResenada: true } : x)),
      );
      this.resenandoId.set(null);
    } catch {
      this.errorResena.set('No se pudo publicar la reseña. Inténtalo de nuevo.');
    } finally {
      this.enviandoResena.set(false);
    }
  }
}
