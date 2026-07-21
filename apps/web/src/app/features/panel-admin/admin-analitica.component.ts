import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, AnaliticaAdmin } from './admin-api.service';

const VERTICAL_EMOJI: Record<string, string> = {
  alojamiento: '🏠', transporte: '🚐', veterinaria: '🩺',
  peluqueria: '✂️', adiestramiento: '🎓', hoteles: '🏨',
};

@Component({
  selector: 'app-admin-analitica',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Analítica</h1>
        <p class="page-sub">Visión de negocio: dónde crece la plataforma y cómo convierte.</p>
      </div>
    </div>

    @if (cargando()) {
      <div style="text-align:center;padding:var(--sp-16);color:var(--t-400)">Cargando analítica…</div>
    } @else if (errorMsg()) {
      <div class="rs-alert rs-alert--error">{{ errorMsg() }}</div>
    } @else {
      <div class="analitica-grid">

        <!-- Embudo de conversión -->
        <div class="rs-card panel">
          <h3 class="panel__title">Embudo de conversión</h3>
          @for (paso of embudoPasos(); track paso.label) {
            <div class="funnel-row">
              <div class="funnel-row__head">
                <span>{{ paso.label }}</span>
                <strong>{{ paso.valor | number:'1.0-0' }}</strong>
              </div>
              <div class="funnel-bar"><div class="funnel-bar__fill" [style.width.%]="paso.pct"></div></div>
              <span class="funnel-row__pct">{{ paso.pct }}%</span>
            </div>
          }
        </div>

        <!-- Ranking por vertical -->
        <div class="rs-card panel">
          <h3 class="panel__title">Distribución por categoría</h3>
          @if (analitica()!.porVertical.length === 0) {
            <p class="empty">Sin reservas todavía.</p>
          }
          @for (v of analitica()!.porVertical; track v.vertical) {
            <div class="rank-row">
              <span class="rank-row__label">{{ emoji(v.vertical) }} {{ v.vertical }}</span>
              <div class="rank-bar"><div class="rank-bar__fill" [style.width.%]="v.porcentaje"></div></div>
              <span class="rank-row__val">{{ v.porcentaje }}% · {{ v.reservas }}</span>
            </div>
          }
        </div>

        <!-- Distribución geográfica -->
        <div class="rs-card panel">
          <h3 class="panel__title">🌍 Distribución geográfica</h3>
          @if (analitica()!.porCiudad.length === 0) {
            <p class="empty">Sin datos de ciudad todavía.</p>
          }
          @for (c of analitica()!.porCiudad; track c.ciudad) {
            <div class="rank-row">
              <span class="rank-row__label">📍 {{ c.ciudad }}</span>
              <div class="rank-bar"><div class="rank-bar__fill rank-bar__fill--gold" [style.width.%]="pctCiudad(c.reservas)"></div></div>
              <span class="rank-row__val">{{ c.reservas }}</span>
            </div>
          }
        </div>

        <!-- Top comercios -->
        <div class="rs-card panel">
          <h3 class="panel__title">🏆 Top 5 comercios</h3>
          @if (analitica()!.topComercios.length === 0) {
            <p class="empty">Sin facturación todavía.</p>
          }
          <div class="top-list">
            @for (t of analitica()!.topComercios; track t.comercio; let i = $index) {
              <div class="top-item">
                <span class="top-item__pos">{{ i + 1 }}</span>
                <span class="top-item__name">{{ t.comercio }}</span>
                <span class="top-item__meta">{{ t.reservas }} reservas</span>
                <strong class="top-item__fact">{{ t.facturacion | number:'1.0-0' }} €</strong>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .page-header { margin-bottom: var(--sp-6); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }
    .analitica-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--sp-5); @media (max-width: 900px) { grid-template-columns: 1fr; } }
    .panel { padding: var(--sp-6); }
    .panel__title { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-5); }
    .empty { color: var(--t-400); font-size: var(--f-sm); }

    .funnel-row { margin-bottom: var(--sp-4); }
    .funnel-row__head { display: flex; justify-content: space-between; font-size: var(--f-sm); color: var(--t-200); margin-bottom: var(--sp-2); strong { color: var(--t-100); } }
    .funnel-bar { height: 10px; background: var(--c-raised); border-radius: var(--r-full); overflow: hidden; }
    .funnel-bar__fill { height: 100%; background: var(--g-accent, var(--c-accent)); border-radius: var(--r-full); transition: width .4s; }
    .funnel-row__pct { font-size: var(--f-xs); color: var(--t-400); }

    .rank-row { display: grid; grid-template-columns: 150px 1fr 90px; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-3); }
    .rank-row__label { font-size: var(--f-sm); color: var(--t-200); text-transform: capitalize; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rank-bar { height: 10px; background: var(--c-raised); border-radius: var(--r-full); overflow: hidden; }
    .rank-bar__fill { height: 100%; background: var(--c-accent); border-radius: var(--r-full); transition: width .4s; }
    .rank-bar__fill--gold { background: var(--c-amber, #FBAE17); }
    .rank-row__val { font-size: var(--f-xs); color: var(--t-400); text-align: right; }

    .top-list { display: flex; flex-direction: column; gap: var(--sp-2); }
    .top-item { display: grid; grid-template-columns: 28px 1fr auto auto; align-items: center; gap: var(--sp-3); padding: var(--sp-3); background: var(--c-raised); border-radius: var(--r-lg); }
    .top-item__pos { width: 24px; height: 24px; border-radius: 50%; background: var(--c-accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: var(--f-xs); font-weight: var(--w-7); }
    .top-item__name { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    .top-item__meta { font-size: var(--f-xs); color: var(--t-400); }
    .top-item__fact { font-size: var(--f-sm); color: var(--c-accent); }
  `],
})
export class AdminAnaliticaComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly errorMsg = signal('');
  readonly analitica = signal<AnaliticaAdmin | null>(null);

  readonly embudoPasos = computed(() => {
    const e = this.analitica()?.embudo;
    if (!e) return [];
    const base = e.registrados || 1;
    return [
      { label: 'Usuarios registrados', valor: e.registrados, pct: 100 },
      { label: 'Con reserva iniciada', valor: e.conReserva, pct: Math.round((e.conReserva / base) * 100) },
      { label: 'Pagaron', valor: e.pagaron, pct: Math.round((e.pagaron / base) * 100) },
    ];
  });

  private readonly maxCiudad = computed(() =>
    Math.max(1, ...(this.analitica()?.porCiudad ?? []).map((c) => c.reservas)));

  async ngOnInit(): Promise<void> {
    try {
      this.analitica.set(await firstValueFrom(this.adminApi.getAnalitica()));
    } catch {
      this.errorMsg.set('Error cargando la analítica. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  emoji(v: string): string { return VERTICAL_EMOJI[v] ?? '📋'; }
  pctCiudad(reservas: number): number { return Math.round((reservas / this.maxCiudad()) * 100); }
}
