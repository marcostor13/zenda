import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { iconoDeVertical } from '../../shared/verticales/verticales.config';
import { AdminApiService, AnaliticaAdmin, ComercioTop, PuntoEvolucion, VerticalAnalitica } from './admin-api.service';

type MetricaVertical = 'reservas' | 'facturacion' | 'comision' | 'comercios';
type OrdenTop = 'facturacion' | 'reservas' | 'valoracion';

@Component({
  selector: 'app-admin-analitica',
  standalone: true,
  imports: [DecimalPipe, RsIconComponent],
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
      <!-- Cabecera de KPIs: cómo va la plataforma en cinco segundos (TCK-8031) -->
      <div class="kpi-fila">
        <div class="rs-card kpi"><span class="kpi__num">{{ analitica()!.kpis.usuariosNuevosMes }}</span><span class="kpi__lbl">Usuarios nuevos (mes)</span></div>
        <div class="rs-card kpi"><span class="kpi__num">{{ analitica()!.kpis.reservas }}</span><span class="kpi__lbl">Reservas</span></div>
        <div class="rs-card kpi"><span class="kpi__num">{{ analitica()!.kpis.conversionPct }} %</span><span class="kpi__lbl">Conversión</span></div>
        <div class="rs-card kpi"><span class="kpi__num">{{ analitica()!.kpis.facturacion | number:'1.0-0' }} €</span><span class="kpi__lbl">Facturación</span></div>
        <div class="rs-card kpi"><span class="kpi__num">{{ analitica()!.kpis.comision | number:'1.0-0' }} €</span><span class="kpi__lbl">Comisión Doogking</span></div>
        <div class="rs-card kpi"><span class="kpi__num">{{ analitica()!.kpis.ticketMedio | number:'1.0-0' }} €</span><span class="kpi__lbl">Ticket medio</span></div>
      </div>

      <!-- Evolución real, no barras estáticas (TCK-8031 §1) -->
      <div class="rs-card panel evolucion">
        <div class="panel__head">
          <h3 class="panel__title">Evolución de los últimos 30 días</h3>
          <div class="evolucion__toggle" role="group" aria-label="Métrica del gráfico">
            <button class="evolucion__btn" [class.activa]="metricaEvolucion() === 'reservas'"
                    (click)="metricaEvolucion.set('reservas')">Reservas</button>
            <button class="evolucion__btn" [class.activa]="metricaEvolucion() === 'facturacion'"
                    (click)="metricaEvolucion.set('facturacion')">Facturación</button>
          </div>
        </div>

        @if (evolucion().length) {
          <svg class="grafico" viewBox="0 0 600 160" preserveAspectRatio="none" role="img"
               [attr.aria-label]="'Evolución de ' + metricaEvolucion() + ' en los últimos 30 días'">
            <polyline class="grafico__linea" [attr.points]="puntosLinea()" />
            @for (b of barras(); track b.fecha) {
              <rect class="grafico__barra" [attr.x]="b.x" [attr.y]="b.y"
                    [attr.width]="b.ancho" [attr.height]="b.alto">
                <title>{{ b.fecha }}: {{ b.valor }}</title>
              </rect>
            }
          </svg>
          <div class="grafico__pie">
            <span>{{ evolucion()[0].fecha }}</span>
            <span>Máximo: {{ maximoEvolucion() }}</span>
            <span>{{ evolucion()[evolucion().length - 1].fecha }}</span>
          </div>
        } @else {
          <p class="empty">Todavía no hay actividad que representar.</p>
        }
      </div>

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
          <div class="panel__head">
            <h3 class="panel__title">Distribución por categoría</h3>
            <select class="rs-inp panel__select" [value]="metricaVertical()"
                    (change)="metricaVertical.set($any($event.target).value)" aria-label="Métrica">
              <option value="reservas">Reservas</option>
              <option value="facturacion">Facturación</option>
              <option value="comision">Comisión Doogking</option>
              <option value="comercios">Nº de comercios</option>
            </select>
          </div>
          @if (analitica()!.porVertical.length === 0) {
            <p class="empty">Sin reservas todavía.</p>
          }
          @for (v of verticalesOrdenados(); track v.vertical) {
            <div class="rank-row">
              <span class="rank-row__label">
                <rs-icon [name]="iconoVertical(v.vertical)" [size]="14" [stroke]="2"></rs-icon>
                {{ v.vertical }}
              </span>
              <div class="rank-bar"><div class="rank-bar__fill" [style.width.%]="pctVertical(v)"></div></div>
              <span class="rank-row__val">{{ valorVertical(v) }}</span>
            </div>
          }
        </div>

        <!-- Distribución geográfica -->
        <div class="rs-card panel">
          <h3 class="panel__title"><rs-icon name="globe" [size]="16" [stroke]="2"></rs-icon> Distribución geográfica</h3>
          @if (analitica()!.porCiudad.length === 0) {
            <p class="empty">Sin datos de ciudad todavía.</p>
          }
          @if (analitica()!.porCiudad.length) {
            <div class="ciudades">
              <div class="ciudades__head"><span>Ciudad</span><span>Comercios</span><span>Reservas</span><span>Facturación</span></div>
              @for (c of analitica()!.porCiudad; track c.ciudad) {
                <div class="ciudades__row">
                  <span class="ciudades__ciudad" data-col="Ciudad">
                    <rs-icon name="map-pin" [size]="13" [stroke]="2"></rs-icon> {{ c.ciudad }}
                  </span>
                  <span data-col="Comercios">{{ c.comercios }}</span>
                  <span data-col="Reservas">{{ c.reservas }}</span>
                  <span data-col="Facturación">{{ c.facturacion | number:'1.0-0' }} €</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Top comercios -->
        <div class="rs-card panel">
          <div class="panel__head">
            <h3 class="panel__title"><rs-icon name="trophy" [size]="16" [stroke]="2"></rs-icon> Top 5 comercios</h3>
            <select class="rs-inp panel__select" [value]="ordenTop()"
                    (change)="ordenTop.set($any($event.target).value)" aria-label="Ordenar top">
              <option value="facturacion">Por facturación</option>
              <option value="reservas">Por reservas</option>
              <option value="valoracion">Por valoración</option>
            </select>
          </div>
          @if (analitica()!.topComercios.length === 0) {
            <p class="empty">Sin facturación todavía.</p>
          }
          <div class="top-list">
            @for (t of topOrdenado(); track t.comercio; let i = $index) {
              <div class="top-item">
                <span class="top-item__pos">{{ i + 1 }}</span>
                <span class="top-item__name">{{ t.comercio }}</span>
                <span class="top-item__meta">
                  {{ t.reservas }} reservas
                  @if (t.valoracion) {
                    · <rs-icon name="star" [size]="11" [stroke]="2" [filled]="true"></rs-icon> {{ t.valoracion | number:'1.1-1' }}
                  }
                </span>
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
    .evolucion { margin-bottom: var(--sp-5); }
    .evolucion__toggle { display: inline-flex; padding: 3px; gap: 2px; background: var(--c-raised); border: 1px solid var(--b-1); border-radius: var(--r-lg); }
    .evolucion__btn {
      padding: var(--sp-2) var(--sp-3); border: none; background: transparent; border-radius: var(--r-md);
      cursor: pointer; font-size: var(--f-xs); font-weight: var(--w-6); color: var(--t-400);
    }
    .evolucion__btn.activa { background: var(--c-card); color: var(--c-accent); }
    .grafico { width: 100%; height: 180px; overflow: visible; }
    .grafico__barra { fill: var(--c-accent-lo); }
    .grafico__linea { fill: none; stroke: var(--c-accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
    .grafico__pie { display: flex; justify-content: space-between; font-size: var(--f-xs); color: var(--t-400); margin-top: var(--sp-2); }

    .kpi-fila { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--sp-3); margin-bottom: var(--sp-5); }
    .kpi { padding: var(--sp-4); display: flex; flex-direction: column; gap: 2px; }
    .kpi__num { font-family: var(--font-accent); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--t-100); line-height: 1.1; }
    .kpi__lbl { font-size: var(--f-xs); color: var(--t-400); }

    .panel__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-5); flex-wrap: wrap; }
    .panel__head .panel__title { margin-bottom: 0; }
    .panel__select { height: 34px; font-size: var(--f-xs); max-width: 190px; }

    .ciudades { display: flex; flex-direction: column; }
    .ciudades__head, .ciudades__row {
      display: grid; grid-template-columns: 1.4fr 90px 90px 110px; gap: var(--sp-3);
      padding: var(--sp-2) 0; border-bottom: 1px solid var(--b-1); font-size: var(--f-sm); color: var(--t-200);
    }
    .ciudades__head { font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .05em; }
    .ciudades__row:last-child { border-bottom: none; }
    .ciudades__ciudad { display: inline-flex; align-items: center; gap: var(--sp-2); }
    @media (max-width: 640px) {
      .ciudades__head { display: none; }
      .ciudades__row { grid-template-columns: 1fr; gap: 2px; padding: var(--sp-3) 0; }
      .ciudades__row > [data-col]::before { content: attr(data-col) ': '; font-size: var(--f-xs); color: var(--t-400); }
      .ciudades__row > .ciudades__ciudad::before { content: none; }
    }

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

  /** Qué se mide en el reparto por categoría y cómo se ordena el top (TCK-8031). */
  readonly metricaVertical = signal<MetricaVertical>('reservas');

  /** Serie diaria y qué métrica se pinta (TCK-8031 §1). */
  readonly evolucion = signal<PuntoEvolucion[]>([]);
  readonly metricaEvolucion = signal<'reservas' | 'facturacion'>('reservas');

  readonly maximoEvolucion = computed(() => {
    const metrica = this.metricaEvolucion();
    return Math.max(1, ...this.evolucion().map((p) => p[metrica]));
  });

  /** Barras del gráfico ya en coordenadas del viewBox 600x160. */
  readonly barras = computed(() => {
    const serie = this.evolucion();
    if (!serie.length) return [];
    const metrica = this.metricaEvolucion();
    const maximo = this.maximoEvolucion();
    const ancho = 600 / serie.length;
    return serie.map((punto, i) => {
      const alto = Math.round((punto[metrica] / maximo) * 140);
      return {
        fecha: punto.fecha,
        valor: punto[metrica],
        x: Math.round(i * ancho) + 1,
        y: 150 - alto,
        ancho: Math.max(2, Math.round(ancho) - 2),
        alto,
      };
    });
  });

  readonly puntosLinea = computed(() =>
    this.barras().map((b) => `${b.x + b.ancho / 2},${b.y}`).join(' '),
  );
  readonly ordenTop = signal<OrdenTop>('facturacion');

  readonly verticalesOrdenados = computed(() => {
    const metrica = this.metricaVertical();
    return [...(this.analitica()?.porVertical ?? [])]
      .sort((a, b) => this.metricaDe(b, metrica) - this.metricaDe(a, metrica));
  });

  private readonly maxVertical = computed(() => {
    const metrica = this.metricaVertical();
    return Math.max(1, ...(this.analitica()?.porVertical ?? []).map((v) => this.metricaDe(v, metrica)));
  });

  readonly topOrdenado = computed(() => {
    const orden = this.ordenTop();
    return [...(this.analitica()?.topComercios ?? [])].sort((a, b) => this.valorTop(b, orden) - this.valorTop(a, orden));
  });

  private readonly maxCiudad = computed(() =>
    Math.max(1, ...(this.analitica()?.porCiudad ?? []).map((c) => c.reservas)));

  private metricaDe(v: VerticalAnalitica, metrica: MetricaVertical): number {
    return metrica === 'reservas' ? v.reservas
      : metrica === 'facturacion' ? v.facturacion
      : metrica === 'comision' ? v.comision
      : v.comercios;
  }

  private valorTop(c: ComercioTop, orden: OrdenTop): number {
    return orden === 'reservas' ? c.reservas : orden === 'valoracion' ? c.valoracion : c.facturacion;
  }

  /** La barra se lee siempre contra el mayor de la métrica elegida. */
  pctVertical(v: VerticalAnalitica): number {
    return Math.round((this.metricaDe(v, this.metricaVertical()) / this.maxVertical()) * 100);
  }

  valorVertical(v: VerticalAnalitica): string {
    const metrica = this.metricaVertical();
    const valor = this.metricaDe(v, metrica);
    if (metrica === 'reservas') return `${v.porcentaje}% · ${valor}`;
    if (metrica === 'comercios') return `${valor} comercio${valor === 1 ? '' : 's'}`;
    return `${Math.round(valor)} €`;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.analitica.set(await firstValueFrom(this.adminApi.getAnalitica()));
      try {
        this.evolucion.set(await firstValueFrom(this.adminApi.getEvolucion(30)));
      } catch {
        // Sin serie, el resto de la analítica se sigue viendo.
      }
    } catch {
      this.errorMsg.set('Error cargando la analítica. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  iconoVertical(vertical: string): string { return iconoDeVertical(vertical); }
  pctCiudad(reservas: number): number { return Math.round((reservas / this.maxCiudad()) * 100); }
}
