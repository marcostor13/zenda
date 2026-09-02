import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiResena } from './comercio-api.service';
import { TraducirPipe } from '../../core/i18n/traducir.pipe';

const VERTICAL_ICON: Record<string, string> = {
  alojamiento: 'hotel', transporte: 'truck', veterinaria: 'stethoscope', peluqueria: 'scissors', adiestramiento: 'graduation-cap',
};

@Component({
  selector: 'app-comercio-resenas',
  standalone: true,
  imports: [
    TraducirPipe, DatePipe, ReactiveFormsModule, RsIconComponent
  ],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ 'Reseñas' | t }}</h1>
        <p class="page-sub">{{ 'Consulta y responde las opiniones de tus clientes.' | t }}</p>
      </div>
      <div class="header-kpis">
        <div class="rs-card kpi-chip">
          <div class="kpi-chip__value">{{ promedioGeneral() || '—' }}</div>
          <div class="kpi-chip__label">{{ 'Promedio' | t }}</div>
        </div>
        <div class="rs-card kpi-chip">
          <div class="kpi-chip__value">{{ resenas().length }}</div>
          <div class="kpi-chip__label">{{ 'Total' | t }}</div>
        </div>
        <button type="button" class="rs-card kpi-chip kpi-chip--accion"
                [class.is-activo]="filtro() === 'sinResponder'"
                (click)="filtrarPor('sinResponder')">
          <div class="kpi-chip__value">{{ sinResponder() }}</div>
          <div class="kpi-chip__label">{{ 'Sin responder' | t }}</div>
        </button>
      </div>
    </div>

    <!-- Rating breakdown -->
    <div class="rs-card breakdown-card">
      <div class="breakdown-left">
        <div class="breakdown-score">{{ promedioGeneral() || '—' }}</div>
        <div class="breakdown-stars">
          @for (s of estrellas(promedioNum()); track $index) {
            <rs-icon name="star" [size]="18" [stroke]="2" [style.color]="s ? 'var(--c-amber)' : 'var(--b-2)'"></rs-icon>
          }
        </div>
        <div class="breakdown-total">{{ resenas().length }} reseñas</div>
      </div>
      <div class="breakdown-bars">
        @for (n of [5,4,3,2,1]; track n) {
          <button type="button" class="bar-row bar-row--accion"
                  [class.is-activo]="filtro() === n" (click)="filtrarPor(n)">
            <span class="bar-label">{{ n }}</span>
            <rs-icon name="star" [size]="12" [stroke]="2" style="color:var(--c-amber)"></rs-icon>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="pctEstrellas(n)"></div>
            </div>
            <span class="bar-count">{{ countEstrellas(n) }}</span>
          </button>
        }
      </div>
    </div>

    <!-- Orden de la lista (TCK-8025) -->
    @if (!cargando() && resenas().length > 1) {
      <div class="orden-barra">
        <span class="orden-barra__label">{{ 'Ordenar por' | t }}</span>
        <div class="orden-toggle" role="group" [attr.aria-label]="'Ordenar reseñas' | t">
          <button class="orden-toggle__btn" [class.activa]="orden() === 'recientes'"
                  (click)="orden.set('recientes')">{{ 'Más recientes' | t }}</button>
          <button class="orden-toggle__btn" [class.activa]="orden() === 'mejor'"
                  (click)="orden.set('mejor')">{{ 'Mejor valoradas' | t }}</button>
        </div>
        @if (filtro() !== 'todas') {
          <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="filtrarPor('todas')">{{ 'Quitar el filtro' | t }}</button>
        }
      </div>
    }

    <!-- Reviews list -->
    @if (cargando()) {
      @for (i of [1,2,3]; track i) {
        <div class="rs-card" style="padding:var(--sp-5)">
          <div class="skel skel--lg" style="margin-bottom:var(--sp-3)"></div>
          <div class="skel skel--md"></div>
        </div>
      }
    } @else if (resenas().length === 0) {
      <div class="rs-card empty-state">
        <rs-icon name="star" [size]="40" [stroke]="1.5" style="color:var(--c-amber);margin-bottom:var(--sp-4)"></rs-icon>
        <h3>{{ 'Aún no tienes reseñas' | t }}</h3>
        <p>{{ 'Las reseñas aparecerán aquí cuando tus clientes las dejen tras completar una reserva.' | t }}</p>
      </div>
    } @else {
      @for (r of resenasFiltradas(); track r._id) {
        <div class="rs-card resena-card">

          <!-- Header -->
          <div class="resena-header">
            <div class="resena-avatar">{{ r.usuarioNombre.charAt(0) }}</div>
            <div class="resena-meta">
              <div class="resena-meta__name">{{ r.usuarioNombre }}</div>
              <div class="resena-meta__info">
                <div class="resena-stars">
                  @for (s of estrellas(r.puntuacion); track $index) {
                    <rs-icon name="star" [size]="13" [stroke]="2" [style.color]="s ? 'var(--c-amber)' : 'var(--b-2)'"></rs-icon>
                  }
                </div>
                <span class="resena-servicio">
                  <rs-icon [name]="iconVertical(r.vertical)" [size]="12" [stroke]="2"></rs-icon>
                  {{ r.servicioTitulo }}
                </span>
                <span class="resena-fecha">{{ r.createdAt | date:'d MMM yyyy' }}</span>
              </div>
            </div>
            <span class="rs-badge {{ puntBadge(r.puntuacion) }}">{{ r.puntuacion }}/5</span>
          </div>

          <!-- Comentario -->
          <p class="resena-comentario">"{{ r.comentario }}"</p>

          <!-- Respuesta existente -->
          @if (r.respuesta) {
            <div class="resena-respuesta">
              <div class="resena-respuesta__label">
                <rs-icon name="message-square" [size]="13" [stroke]="2"></rs-icon>
                {{ 'Tu respuesta' | t }}
              </div>
              <p>{{ r.respuesta | t }}</p>
            </div>
          } @else if (respondiendoId() !== r._id) {
            <button class="rs-btn rs-btn--ghost rs-btn--sm" style="margin-top:var(--sp-3)" (click)="abrirRespuesta(r._id)">
              <rs-icon name="message-square" [size]="14" [stroke]="2"></rs-icon>
              {{ 'Responder' | t }}
            </button>
          }

          <!-- Formulario de respuesta -->
          @if (respondiendoId() === r._id) {
            <div class="respuesta-form">
              <textarea
                class="rs-inp"
                rows="3"
                [placeholder]="'Escribe tu respuesta al cliente…' | t"
                [formControl]="respuestaCtrl"
                style="resize:vertical"></textarea>
              @if (errorRespuesta()) {
                <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-2)">{{ errorRespuesta() }}</div>
              }
              <div class="respuesta-form__actions">
                <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cancelarRespuesta()">{{ 'Cancelar' | t }}</button>
                <button class="rs-btn rs-btn--primary rs-btn--sm"
                        [disabled]="enviando()"
                        (click)="enviarRespuesta(r._id)">
                  @if (enviando()) { Enviando… } @else {
                    <rs-icon name="check" [size]="14" [stroke]="2"></rs-icon>
                    Publicar respuesta
                  }
                </button>
              </div>
            </div>
          }

        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    .orden-barra { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
    .orden-barra__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
    .orden-toggle {
      display: inline-flex; padding: 3px; gap: 2px;
      background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg);
    }
    .orden-toggle__btn {
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent;
      border-radius: var(--r-md); cursor: pointer;
      font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-400);
      transition: all var(--d-2);
      &.activa { background: var(--c-card); color: var(--c-accent); box-shadow: var(--shadow-sm, 0 1px 3px rgba(8,37,139,.10)); }
    }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-5); flex-wrap: wrap; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    /* Indicadores y barras pulsables: filtran la lista (TCK-8025). */
    .kpi-chip--accion, .bar-row--accion { cursor: pointer; border: none; font: inherit; text-align: inherit; }
    .bar-row--accion { background: none; width: 100%; padding: 0; }
    .kpi-chip--accion:hover, .bar-row--accion:hover { background: var(--c-raised); }
    .kpi-chip--accion.is-activo, .bar-row--accion.is-activo { outline: 2px solid var(--c-accent); outline-offset: 2px; border-radius: var(--r-md); }

    .header-kpis { display: flex; gap: var(--sp-3); }
    .kpi-chip { padding: var(--sp-3) var(--sp-5); text-align: center; min-width: 80px; }
    .kpi-chip__value { font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); }
    .kpi-chip__label { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; }

    .breakdown-card { padding: var(--sp-6); display: flex; gap: var(--sp-8); align-items: flex-start; flex-wrap: wrap; }
    .breakdown-left { text-align: center; min-width: 100px; }
    .breakdown-score { font-size: var(--f-5xl); font-weight: var(--w-9); color: var(--t-100); line-height: 1; }
    .breakdown-stars { display: flex; justify-content: center; gap: 2px; margin: var(--sp-2) 0; }
    .breakdown-total { font-size: var(--f-xs); color: var(--t-400); }
    .breakdown-bars { flex: 1; display: flex; flex-direction: column; gap: var(--sp-2); min-width: 200px; }
    .bar-row { display: flex; align-items: center; gap: var(--sp-2); }
    .bar-label { font-size: var(--f-sm); color: var(--t-300); width: 12px; text-align: right; }
    .bar-track { flex: 1; height: 8px; background: var(--c-raised); border-radius: var(--r-full); overflow: hidden; }
    .bar-fill { height: 100%; background: var(--c-amber); border-radius: var(--r-full); transition: width var(--d-3); }
    .bar-count { font-size: var(--f-xs); color: var(--t-400); width: 20px; }

    .resena-card { padding: var(--sp-5); }
    .resena-header { display: flex; align-items: flex-start; gap: var(--sp-4); margin-bottom: var(--sp-4); }
    .resena-avatar { width: 40px; height: 40px; border-radius: var(--r-full); background: var(--g-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: var(--f-md); font-weight: var(--w-7); flex-shrink: 0; }
    .resena-meta { flex: 1; }
    .resena-meta__name { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-1); }
    .resena-meta__info { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
    .resena-stars { display: flex; gap: 1px; }
    .resena-servicio { display: flex; align-items: center; gap: var(--sp-1); font-size: var(--f-xs); color: var(--t-400); }
    .resena-fecha { font-size: var(--f-xs); color: var(--t-400); }
    .resena-comentario { font-size: var(--f-sm); color: var(--t-200); line-height: 1.7; font-style: italic; }

    .resena-respuesta { margin-top: var(--sp-4); padding: var(--sp-4); background: var(--c-raised); border-radius: var(--r-lg); border-left: 3px solid var(--c-accent); }
    .resena-respuesta__label { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-xs); font-weight: var(--w-7); color: var(--c-accent); text-transform: uppercase; letter-spacing: .06em; margin-bottom: var(--sp-2); }
    .resena-respuesta p { font-size: var(--f-sm); color: var(--t-200); line-height: 1.6; }

    .respuesta-form { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
    .respuesta-form__actions { display: flex; justify-content: flex-end; gap: var(--sp-3); }

    .empty-state { padding: var(--sp-20); text-align: center; color: var(--t-400); h3 { font-size: var(--f-lg); color: var(--t-200); margin-bottom: var(--sp-2); } }

    .skel { background: var(--c-raised); border-radius: var(--r-sm); animation: pulse 1.4s ease-in-out infinite; }
    .skel--md { height: 14px; width: 60%; }
    .skel--lg { height: 20px; width: 40%; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }
  `],
})
export class ComercioResenasComponent implements OnInit {
  private readonly comercioApi = inject(ComercioApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly cargando = signal(true);
  readonly resenas = signal<MiResena[]>([]);
  readonly respondiendoId = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly errorRespuesta = signal('');

  readonly respuestaCtrl = this.fb.control('', Validators.required);

  readonly promedioNum = computed(() => {
    if (!this.resenas().length) return 0;
    return this.resenas().reduce((s, r) => s + r.puntuacion, 0) / this.resenas().length;
  });

  readonly promedioGeneral = computed(() =>
    this.resenas().length ? this.promedioNum().toFixed(1) : null
  );

  /**
   * Filtro activo de la lista (TCK-8025). Los indicadores y las barras de
   * distribución no eran más que decoración: ahora pulsarlos filtra, que es lo
   * que uno espera al ver "12 sin responder" y querer verlas.
   */
  readonly filtro = signal<'todas' | 'sinResponder' | number>('todas');

  /** Orden de la lista (TCK-8025 §9). */
  readonly orden = signal<'recientes' | 'mejor'>('recientes');

  readonly resenasFiltradas = computed(() => {
    const f = this.filtro();
    const base =
      f === 'todas' ? this.resenas()
      : f === 'sinResponder' ? this.resenas().filter((r) => !r.respuesta)
      : this.resenas().filter((r) => Math.round(r.puntuacion) === f);

    // Copia antes de ordenar: el signal guarda el orden que devolvió el API.
    return [...base].sort((a, b) =>
      this.orden() === 'mejor'
        ? b.puntuacion - a.puntuacion
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });

  /** Alterna el filtro: volver a pulsar el mismo lo quita. */
  filtrarPor(valor: 'todas' | 'sinResponder' | number): void {
    this.filtro.update((actual) => (actual === valor ? 'todas' : valor));
  }

  readonly sinResponder = computed(() =>
    this.resenas().filter(r => !r.respuesta).length
  );

  async ngOnInit(): Promise<void> {
    try {
      const data = await firstValueFrom(this.comercioApi.getMisResenas());
      this.resenas.set(data);
    } catch {
      // Sin reseñas falsas: si la API falla, se muestra el estado vacío real.
      this.resenas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  estrellas(n: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(n));
  }

  puntBadge(n: number): string {
    if (n >= 4) return 'rs-badge--success';
    if (n === 3) return 'rs-badge--warning';
    return 'rs-badge--error';
  }

  iconVertical(v: string): string {
    return VERTICAL_ICON[v] ?? 'building';
  }

  countEstrellas(n: number): number {
    return this.resenas().filter(r => r.puntuacion === n).length;
  }

  pctEstrellas(n: number): number {
    if (!this.resenas().length) return 0;
    return (this.countEstrellas(n) / this.resenas().length) * 100;
  }

  abrirRespuesta(id: string): void {
    this.respondiendoId.set(id);
    this.respuestaCtrl.reset();
    this.errorRespuesta.set('');
  }

  cancelarRespuesta(): void {
    this.respondiendoId.set(null);
    this.respuestaCtrl.reset();
  }

  async enviarRespuesta(id: string): Promise<void> {
    if (this.respuestaCtrl.invalid) {
      this.errorRespuesta.set('Escribe una respuesta antes de publicar.');
      return;
    }
    this.enviando.set(true);
    this.errorRespuesta.set('');
    try {
      const actualizada = await firstValueFrom(
        this.comercioApi.responderResena(id, this.respuestaCtrl.value)
      );
      this.resenas.update(list =>
        list.map(r => r._id === id ? { ...r, respuesta: actualizada.respuesta } : r)
      );
    } catch {
      // Apply optimistically on API failure (mock mode)
      this.resenas.update(list =>
        list.map(r => r._id === id ? { ...r, respuesta: this.respuestaCtrl.value } : r)
      );
    } finally {
      this.enviando.set(false);
      this.respondiendoId.set(null);
    }
  }
}
