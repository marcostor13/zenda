import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { VerticalKey, VERTICAL_LABELS } from 'shared';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { ImgFallbackDirective } from '../../../shared/directives/img-fallback.directive';
import { alojamientoImage } from '../../../shared/media/images';
import { ReservasService, ReservaApi } from '../services/reservas.service';
import { ReviewsService } from '../services/reviews.service';
import { AlojamientoService } from '../../alojamiento/services/alojamiento.service';
import { AuthService } from '../../../core/auth/auth.service';

type EstadoFiltro = 'todas' | 'confirmada' | 'pendiente' | 'ajuste_solicitado' | 'cancelada' | 'completada';

interface ReservaCard {
  id: string;
  codigo: string;
  servicioId: string;
  verticalKey: string;
  vertical: string;
  /** Nombre de icono de `rs-icon` (Lucide) del vertical. */
  icono: string;
  titulo: string;
  subtitulo: string;
  imagen: string;
  fechaInicio: string;
  fechaFin: string;
  /** Fechas ISO sin formatear, para exportar (calendario, etc.) sin re-parsear texto localizado. */
  fechaInicioIso: string;
  fechaFinIso: string;
  total: number;
  estado: 'confirmada' | 'pendiente' | 'ajuste_solicitado' | 'cancelada' | 'completada';
  montoAjustado?: number;
  suplementosMotivo?: string;
  yaResenada: boolean;
  mascota?: string;
  ciudad?: string;
}

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, RsNavbarComponent, RsIconComponent, ImgFallbackDirective],
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
                [style.background]="filtroActivo() === f.valor ? f.color : null"
                [style.border-color]="filtroActivo() === f.valor ? f.color : null"
                (click)="filtroActivo.set(f.valor)">
          @if (f.dot) { <span aria-hidden="true">{{ f.dot }}</span> }
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
              <span class="rs-badge rs-badge--purple" style="font-size:var(--f-xs)"><rs-icon [name]="r.icono" [size]="13" [stroke]="2" /> {{ r.vertical }}</span>
              <span class="{{ 'rs-badge ' + estadoBadge(r.estado) }}">{{ estadoLabel(r.estado) }}</span>
            </div>
            <h3 class="reserva-row__titulo">{{ r.titulo }}</h3>
            <div class="reserva-row__meta">
              @if (r.mascota) { <span class="reserva-row__mascota"><rs-icon name="dog" [size]="14" [stroke]="2" /> {{ r.mascota }}</span> }
              @if (r.ciudad) { <span class="reserva-row__ciudad"><rs-icon name="map-pin" [size]="14" [stroke]="2" /> {{ r.ciudad }}</span> }
              <span class="reserva-row__subtitulo">{{ r.subtitulo }}</span>
            </div>
            <div class="reserva-row__fechas">
              <span><rs-icon name="calendar" [size]="14" [stroke]="2" /> {{ r.fechaInicio }}</span>
              @if (r.fechaFin !== r.fechaInicio) {
                <span>→ {{ r.fechaFin }}</span>
              }
            </div>

            @if (r.estado !== 'cancelada') {
              <div class="timeline">
                @for (paso of pasosTimeline(r); track paso.label; let last = $last) {
                  <span class="timeline__paso" [class.timeline__paso--hecho]="paso.hecho" [class.timeline__paso--actual]="paso.actual">
                    <rs-icon [name]="paso.hecho ? 'check' : 'circle'" [size]="13" [stroke]="2.5" /> {{ paso.label }}
                  </span>
                  @if (!last) { <span class="timeline__linea" [class.timeline__linea--hecha]="paso.hecho"></span> }
                }
              </div>
            }
          </div>

          <div class="reserva-row__aside">
            <div class="reserva-row__codigo">{{ r.codigo }}</div>
            <div class="reserva-row__precio">€{{ r.total }}</div>
            <div class="reserva-row__quick">
              <button type="button" class="quick-btn" title="Cómo llegar" aria-label="Cómo llegar" (click)="comoLlegar(r)">
                <rs-icon name="navigation" [size]="16" [stroke]="2" />
              </button>
              <button type="button" class="quick-btn" title="Añadir al calendario" aria-label="Añadir al calendario" (click)="anadirACalendario(r)">
                <rs-icon name="calendar-plus" [size]="16" [stroke]="2" />
              </button>
              <button type="button" class="quick-btn" title="Compartir" aria-label="Compartir" (click)="compartir(r)">
                <rs-icon name="share" [size]="16" [stroke]="2" />
              </button>
            </div>
            <div style="display:flex;flex-direction:column;gap:var(--sp-2);margin-top:var(--sp-3)">
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
                <span class="rs-badge rs-badge--success" style="font-size:var(--f-xs)"><rs-icon name="check" [size]="12" [stroke]="3" /> Reseñada</span>
              }
              @if (r.estado === 'completada') {
                <a [routerLink]="rutaReservarDeNuevo(r)" class="rs-btn rs-btn--outline rs-btn--sm"><rs-icon name="refresh-cw" [size]="14" [stroke]="2" /> Reservar de nuevo</a>
              }
            </div>
          </div>
        </div>

        @if (necesitaChecklist(r)) {
          <div class="checklist-antes-de-ir">
            <strong><rs-icon name="dog" [size]="16" [stroke]="2" /> Antes de ir recuerda llevar:</strong>
            <span><rs-icon name="check" [size]="13" [stroke]="3" /> Cartilla sanitaria</span>
            <span><rs-icon name="check" [size]="13" [stroke]="3" /> Su pienso habitual</span>
            <span><rs-icon name="check" [size]="13" [stroke]="3" /> Medicación (si toma)</span>
            <span><rs-icon name="check" [size]="13" [stroke]="3" /> Correa y collar</span>
          </div>
        }

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
          <rs-icon name="search" [size]="48" [stroke]="1.5" style="color:var(--t-400);margin-bottom:var(--sp-4)" />
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
    .reserva-row__subtitulo { font-size: var(--f-sm); color: var(--t-400); }
    .reserva-row__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-3); }
    .reserva-row__mascota { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }
    .reserva-row__ciudad { font-size: var(--f-sm); color: var(--t-300); }
    .reserva-row__fechas { font-size: var(--f-sm); color: var(--t-300); display: flex; gap: var(--sp-3); }
    .reserva-row__aside { text-align: right; @media (max-width: 768px) { text-align: left; } }
    .reserva-row__codigo { font-size: var(--f-xs); color: var(--t-400); margin-bottom: var(--sp-1); font-family: monospace; }
    .reserva-row__precio { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
    .reserva-row__quick { display: flex; justify-content: flex-end; gap: var(--sp-2); margin-top: var(--sp-3); @media (max-width: 768px) { justify-content: flex-start; } }
    .quick-btn {
      width: 32px; height: 32px; border-radius: var(--r-full); border: 1px solid var(--b-1);
      background: var(--c-raised); cursor: pointer; font-size: 14px; line-height: 1;
      transition: all var(--d-2);
      &:hover { border-color: var(--b-2); background: var(--c-accent-lo); }
    }

    /* HU-9.4: timeline de estado de la reserva */
    .timeline { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-1); margin-top: var(--sp-3); }
    .timeline__paso {
      font-size: var(--f-xs); color: var(--t-400); white-space: nowrap;
    }
    .timeline__paso--hecho { color: var(--c-success, #16A34A); font-weight: var(--w-6); }
    .timeline__paso--actual { color: var(--c-accent); font-weight: var(--w-7); }
    .timeline__linea { width: 16px; height: 1px; background: var(--b-1); }
    .timeline__linea--hecha { background: var(--c-success, #16A34A); }

    .empty-state { text-align: center; padding: var(--sp-20) var(--sp-8); h3 { font-size: var(--f-xl); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-3); } p { color: var(--t-400); } }

    .ajuste-banner {
      display: flex; justify-content: space-between; align-items: center; gap: var(--sp-4);
      padding: var(--sp-4) var(--sp-5); border-color: var(--c-amber); flex-wrap: wrap;
      strong { color: var(--t-100); font-size: var(--f-sm); }
      p { color: var(--t-400); font-size: var(--f-xs); margin-top: var(--sp-1); }
    }

    .checklist-antes-de-ir {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-5); margin-top: calc(-1 * var(--sp-2));
      background: var(--c-accent-lo); border-radius: var(--r-lg);
      font-size: var(--f-xs); color: var(--t-300);
      strong { color: var(--dk-blue); font-size: var(--f-sm); }
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
      servicioId: 'servicio-mock-1',
      verticalKey: VerticalKey.ALOJAMIENTO,
      vertical: 'Alojamiento canino',
      icono: 'home',
      titulo: 'Residencia Canina Villa Perruna',
      subtitulo: 'Suite estándar · 2 noches · 1 perro',
      imagen: alojamientoImage(0, 400),
      fechaInicio: '15 Jul 2026',
      fechaFin: '17 Jul 2026',
      fechaInicioIso: '2026-07-15',
      fechaFinIso: '2026-07-17',
      total: 76,
      estado: 'confirmada',
      yaResenada: false,
    },
    {
      id: 'mock-2',
      codigo: 'RES-D4E5F6',
      servicioId: 'servicio-mock-2',
      verticalKey: VerticalKey.TRANSPORTE,
      vertical: 'Transporte de animales',
      icono: 'truck',
      titulo: 'Traslado canino Madrid Centro',
      subtitulo: 'Madrid → Toledo · Van acondicionada',
      imagen: alojamientoImage(7, 400),
      fechaInicio: '14 Jul 2026',
      fechaFin: '14 Jul 2026',
      fechaInicioIso: '2026-07-14',
      fechaFinIso: '2026-07-14',
      total: 45,
      estado: 'completada',
      yaResenada: false,
    },
    {
      id: 'mock-3',
      codigo: 'RES-G7H8I9',
      servicioId: 'servicio-mock-3',
      verticalKey: VerticalKey.PELUQUERIA,
      vertical: 'Peluquerías caninas',
      icono: 'scissors',
      titulo: 'Peluquería Canina Real Grooming',
      subtitulo: 'Baño y corte · Perro mediano',
      imagen: alojamientoImage(8, 400),
      fechaInicio: '20 Ago 2026',
      fechaFin: '20 Ago 2026',
      fechaInicioIso: '2026-08-20',
      fechaFinIso: '2026-08-20',
      total: 38,
      estado: 'pendiente',
      yaResenada: false,
    },
  ];

  readonly filtroActivo = signal<EstadoFiltro>('todas');

  readonly filtros: { valor: EstadoFiltro; label: string; dot: string; color: string }[] = [
    { valor: 'todas',             label: 'Todas',       dot: '',   color: 'var(--c-accent)' },
    { valor: 'confirmada',        label: 'Confirmadas', dot: '●', color: 'var(--c-success, #16A34A)' },
    { valor: 'pendiente',         label: 'Pendientes',  dot: '●', color: 'var(--c-warning, #CA8A04)' },
    { valor: 'ajuste_solicitado', label: 'Con ajuste',  dot: '●', color: 'var(--c-warning, #EA580C)' },
    { valor: 'completada',        label: 'Completadas', dot: '●', color: 'var(--c-accent)' },
    { valor: 'cancelada',         label: 'Canceladas',  dot: '●', color: 'var(--c-red, #DC2626)' },
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
      confirmada: 'Confirmada',
      pendiente:  'Pendiente',
      ajuste_solicitado: 'Ajuste pendiente',
      cancelada:  'Cancelada',
      completada: 'Completada',
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
    let ciudad = (r.detalle?.['ciudad'] as string) ?? '';

    try {
      const servicio = await this.alojamientoService.obtener(r.servicioId);
      titulo = servicio.nombre;
      imagen = servicio.imagenes?.[0] ?? imagen;
      ciudad = servicio.ciudad ?? ciudad;
    } catch {
      // Si no se puede hidratar, se usa el título/imagen de respaldo.
    }

    const id = r._id ?? r.id ?? '';
    return {
      id,
      codigo: r.codigo,
      servicioId: r.servicioId,
      verticalKey: r.vertical,
      vertical: meta.label,
      icono: meta.icono,
      titulo,
      subtitulo: this.subtituloReserva(r),
      imagen,
      fechaInicio: this.formatearFecha(r.fechaInicio),
      fechaFin: this.formatearFecha(r.fechaFin ?? r.fechaInicio),
      fechaInicioIso: r.fechaInicio,
      fechaFinIso: r.fechaFin ?? r.fechaInicio,
      total: r.montoTotal,
      estado: this.normalizarEstado(r.estado),
      montoAjustado: r.montoAjustado,
      yaResenada: resenadasIds.has(id),
      mascota: (r.perroSnapshot?.['nombre'] as string) ?? undefined,
      ciudad: ciudad || undefined,
    };
  }

  private verticalMeta(vertical: string): { label: string; icono: string } {
    const map: Record<string, { label: string; icono: string }> = {
      [VerticalKey.ALOJAMIENTO]:    { label: VERTICAL_LABELS[VerticalKey.ALOJAMIENTO],    icono: 'home' },
      [VerticalKey.TRANSPORTE]:     { label: VERTICAL_LABELS[VerticalKey.TRANSPORTE],     icono: 'truck' },
      [VerticalKey.VETERINARIA]:    { label: VERTICAL_LABELS[VerticalKey.VETERINARIA],    icono: 'stethoscope' },
      [VerticalKey.PELUQUERIA]:     { label: VERTICAL_LABELS[VerticalKey.PELUQUERIA],     icono: 'scissors' },
      [VerticalKey.ADIESTRAMIENTO]: { label: VERTICAL_LABELS[VerticalKey.ADIESTRAMIENTO], icono: 'graduation-cap' },
      [VerticalKey.HOTELES]:        { label: VERTICAL_LABELS[VerticalKey.HOTELES],        icono: 'hotel' },
    };
    return map[vertical] ?? { label: vertical, icono: 'paw' };
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

  /** Verticales con ficha de detalle propia (Fase 4); las demás solo tienen listado. */
  private readonly VERTICALES_CON_FICHA = new Set<string>([
    VerticalKey.ALOJAMIENTO, VerticalKey.TRANSPORTE, VerticalKey.ADIESTRAMIENTO, VerticalKey.HOTELES,
  ]);

  /** Ruta para "Reservar de nuevo" (HU-9.6): a la ficha si existe, si no al listado del vertical. */
  rutaReservarDeNuevo(r: ReservaCard): string[] {
    if (this.VERTICALES_CON_FICHA.has(r.verticalKey) && r.servicioId) {
      return [`/${r.verticalKey}`, r.servicioId];
    }
    return [`/${r.verticalKey}`];
  }

  /** HU-9.7: recordatorio de qué llevar, solo para estancias (alojamiento/hoteles) próximas. */
  necesitaChecklist(r: ReservaCard): boolean {
    return (r.verticalKey === VerticalKey.ALOJAMIENTO || r.verticalKey === VerticalKey.HOTELES)
      && (r.estado === 'confirmada' || r.estado === 'pendiente');
  }

  /** HU-9.4: línea temporal simplificada, aplicable a cualquier vertical (no solo estancias). */
  pasosTimeline(r: ReservaCard): { label: string; hecho: boolean; actual: boolean }[] {
    const confirmada = r.estado === 'confirmada' || r.estado === 'completada';
    const completada = r.estado === 'completada';
    const valorada = completada && r.yaResenada;
    return [
      { label: 'Reserva realizada', hecho: true, actual: false },
      { label: 'Confirmada', hecho: confirmada, actual: !confirmada },
      { label: 'Servicio', hecho: completada, actual: confirmada && !completada },
      { label: 'Valorada', hecho: valorada, actual: completada && !valorada },
    ];
  }

  /** HU-9.3: acciones rápidas — cómo llegar, calendario, compartir. */
  comoLlegar(r: ReservaCard): void {
    const consulta = encodeURIComponent(`${r.titulo}${r.ciudad ? ', ' + r.ciudad : ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${consulta}`, '_blank', 'noopener');
  }

  anadirACalendario(r: ReservaCard): void {
    const inicio = this.aFechaIcs(r.fechaInicioIso);
    const fin = this.aFechaIcs(r.fechaFinIso || r.fechaInicioIso);
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `UID:${r.codigo}@doogking.com`,
      `SUMMARY:${r.titulo} (${r.codigo})`,
      `DTSTART;VALUE=DATE:${inicio}`,
      `DTEND;VALUE=DATE:${fin}`,
      `LOCATION:${r.ciudad ?? ''}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doogking-${r.codigo}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private aFechaIcs(fechaIso: string): string {
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toISOString().slice(0, 10).replace(/-/g, '');
  }

  async compartir(r: ReservaCard): Promise<void> {
    const texto = `Mi reserva en Doogking: ${r.titulo} (${r.codigo}), ${r.fechaInicio}.`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'Doogking', text: texto });
        return;
      } catch {
        // El usuario canceló el share nativo: caemos al portapapeles.
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Sin acceso al portapapeles (permiso denegado): no hay más que ofrecer.
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
