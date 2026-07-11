import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { ComercioApiService, MiResena } from './comercio-api.service';

const VERTICAL_ICON: Record<string, string> = {
  alojamiento: 'hotel', transporte: 'truck', veterinaria: 'stethoscope', peluqueria: 'scissors', adiestramiento: 'graduation-cap',
};

@Component({
  selector: 'app-comercio-resenas',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RsIconComponent],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Reseñas</h1>
        <p class="page-sub">Opiniones de tus clientes sobre tus servicios.</p>
      </div>
      <div class="header-kpis">
        <div class="rs-card kpi-chip">
          <div class="kpi-chip__value">{{ promedioGeneral() || '—' }}</div>
          <div class="kpi-chip__label">Promedio</div>
        </div>
        <div class="rs-card kpi-chip">
          <div class="kpi-chip__value">{{ resenas().length }}</div>
          <div class="kpi-chip__label">Total</div>
        </div>
        <div class="rs-card kpi-chip">
          <div class="kpi-chip__value">{{ sinResponder() }}</div>
          <div class="kpi-chip__label">Sin responder</div>
        </div>
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
          <div class="bar-row">
            <span class="bar-label">{{ n }}</span>
            <rs-icon name="star" [size]="12" [stroke]="2" style="color:var(--c-amber)"></rs-icon>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="pctEstrellas(n)"></div>
            </div>
            <span class="bar-count">{{ countEstrellas(n) }}</span>
          </div>
        }
      </div>
    </div>

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
        <h3>Aún no tienes reseñas</h3>
        <p>Las reseñas aparecerán aquí cuando tus clientes las dejen tras completar una reserva.</p>
      </div>
    } @else {
      @for (r of resenas(); track r._id) {
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
                Tu respuesta
              </div>
              <p>{{ r.respuesta }}</p>
            </div>
          } @else if (respondiendoId() !== r._id) {
            <button class="rs-btn rs-btn--ghost rs-btn--sm" style="margin-top:var(--sp-3)" (click)="abrirRespuesta(r._id)">
              <rs-icon name="message-square" [size]="14" [stroke]="2"></rs-icon>
              Responder
            </button>
          }

          <!-- Formulario de respuesta -->
          @if (respondiendoId() === r._id) {
            <div class="respuesta-form">
              <textarea
                class="rs-inp"
                rows="3"
                placeholder="Escribe tu respuesta al cliente…"
                [formControl]="respuestaCtrl"
                style="resize:vertical"></textarea>
              @if (errorRespuesta()) {
                <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-2)">{{ errorRespuesta() }}</div>
              }
              <div class="respuesta-form__actions">
                <button class="rs-btn rs-btn--ghost rs-btn--sm" (click)="cancelarRespuesta()">Cancelar</button>
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

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--sp-5); flex-wrap: wrap; }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

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
