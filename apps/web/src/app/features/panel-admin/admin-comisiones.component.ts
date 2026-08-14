import { Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ComisionConfig } from './admin-api.service';
import { RsIconComponent } from '../../shared/components/icon/rs-icon.component';
import { iconoDeVertical } from '../../shared/verticales/verticales.config';

/**
 * Comisiones por vertical en su propio apartado (TCK-8040 §5). Vivían dentro del
 * Dashboard, donde competían con los KPIs y quedaban escondidas pese a ser la
 * palanca económica principal de la plataforma.
 */
@Component({
  selector: 'app-admin-comisiones',
  standalone: true,
  imports: [RsIconComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Comisiones</h1>
        <p class="page-sub">Qué cobra Doogking por cada reserva y qué deja de ingresar el comercio.</p>
      </div>
      <button class="rs-btn rs-btn--primary rs-btn--sm" (click)="guardar()">
        <rs-icon name="save" [size]="14" [stroke]="2"></rs-icon> Guardar cambios
      </button>
    </div>

    <div class="rs-card admin-panel">
      <p class="panel-nota">
        La columna <strong>Comisión total</strong> es lo que el comercio deja de cobrar por cada
        reserva: comisión de Doogking más el coste de la pasarela de pago.
      </p>

      @if (cargando()) {
        <p style="color:var(--t-400)">Cargando comisiones…</p>
      } @else {
        <div class="comisiones-table">
          <div class="comisiones-head">
            <span>Vertical</span>
            <span>Comisión (%)</span>
            <span>Fee Stripe</span>
            <span>Comisión total</span>
            <span>Estado</span>
          </div>
          @for (c of comisiones(); track c.vertical) {
            <div class="comisiones-row">
              <span class="comision-vertical">
                <rs-icon [name]="iconoVertical(c.vertical)" [size]="14" [stroke]="2"></rs-icon>
                {{ c.vertical }}
              </span>
              <div data-col="Comisión" style="display:flex;align-items:center;gap:var(--sp-2)">
                <input type="number" class="rs-inp" style="width:80px;text-align:center"
                       [value]="(c.comisionPct * 100).toFixed(0)"
                       (input)="actualizarPct(c, +$any($event).target.value)" />
                <span style="color:var(--t-400)">%</span>
              </div>
              <span data-col="Fee Stripe" style="color:var(--t-400);font-size:var(--f-sm)">
                {{ (c.stripePct * 100).toFixed(1) }}% + {{ c.stripeFijoEur.toFixed(2) }} €
              </span>
              <span data-col="Total" style="font-weight:var(--w-7);color:var(--t-100);font-size:var(--f-sm)">
                {{ comisionTotal(c) }}%
              </span>
              <label data-col="Estado" style="display:flex;align-items:center;gap:var(--sp-2);cursor:pointer">
                <input type="checkbox" [checked]="c.activo" (change)="c.activo = !c.activo"
                       style="accent-color:var(--c-accent)" />
                <span class="rs-badge" [class]="c.activo ? 'rs-badge--success' : 'rs-badge--warning'">
                  {{ c.activo ? 'Activo' : 'Pausado' }}
                </span>
              </label>
            </div>
          }
        </div>
      }

      @if (guardadoMsg()) {
        <div class="rs-alert rs-alert--success" style="margin-top:var(--sp-4)">
          <rs-icon name="check-circle" [size]="15" [stroke]="2"></rs-icon> Comisiones actualizadas exitosamente
        </div>
      }
      @if (errorMsg()) {
        <div class="rs-alert rs-alert--error" style="margin-top:var(--sp-4)">{{ errorMsg() }}</div>
      }
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--sp-4); }
    .page-title { font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--t-100); margin-bottom: var(--sp-1); }
    .page-sub { color: var(--t-400); font-size: var(--f-sm); }

    .admin-panel { padding: var(--sp-6); }
    .panel-nota { font-size: var(--f-sm); color: var(--t-400); margin-bottom: var(--sp-4); max-width: 70ch; }

    .comisiones-table { background: var(--c-raised); border-radius: var(--r-xl); overflow: hidden; }
    .comisiones-head { display: grid; grid-template-columns: 1fr 160px 180px 120px 120px; padding: var(--sp-3) var(--sp-5); font-size: var(--f-xs); color: var(--t-400); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid var(--b-1); }
    .comisiones-row { display: grid; grid-template-columns: 1fr 160px 180px 120px 120px; padding: var(--sp-4) var(--sp-5); align-items: center; border-bottom: 1px solid var(--b-1); }
    .comisiones-row:last-child { border: none; }
    .comisiones-row:hover { background: var(--c-card); }
    .comision-vertical { display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); font-weight: var(--w-5); color: var(--t-100); text-transform: capitalize; }

    /* Móvil: cada campo bajo su etiqueta; un porcentaje suelto no se sabe de qué es. */
    @media (max-width: 768px) {
      .comisiones-head { display: none; }
      .comisiones-row {
        grid-template-columns: 1fr;
        gap: var(--sp-3);
        border-bottom: 6px solid var(--c-base);
      }
      .comisiones-row > [data-col] {
        display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4);
      }
      .comisiones-row > [data-col]::before {
        content: attr(data-col);
        font-family: var(--font-accent);
        font-size: var(--f-xs); font-weight: var(--w-7);
        letter-spacing: .06em; text-transform: uppercase; color: var(--t-400);
      }
    }
  `],
})
export class AdminComisionesComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly cargando = signal(true);
  readonly comisiones = signal<ComisionConfig[]>([]);
  readonly guardadoMsg = signal(false);
  readonly errorMsg = signal('');

  async ngOnInit(): Promise<void> {
    try {
      this.comisiones.set(await firstValueFrom(this.adminApi.getComisiones()));
    } catch {
      this.errorMsg.set('Error cargando las comisiones. Verifica que el API esté activo.');
    } finally {
      this.cargando.set(false);
    }
  }

  iconoVertical(vertical: string): string {
    return iconoDeVertical(vertical);
  }

  /** Comisión plataforma + fee variable de Stripe, redondeado a 1 decimal. */
  comisionTotal(comision: ComisionConfig): string {
    return ((comision.comisionPct + comision.stripePct) * 100).toFixed(1).replace('.', ',');
  }

  actualizarPct(comision: ComisionConfig, pct: number): void {
    comision.comisionPct = pct / 100;
  }

  async guardar(): Promise<void> {
    this.errorMsg.set('');
    this.guardadoMsg.set(false);
    try {
      await Promise.all(
        this.comisiones().map((c) =>
          firstValueFrom(this.adminApi.updateComision({
            vertical: c.vertical,
            comisionPct: c.comisionPct,
            stripePct: c.stripePct,
            stripeFijoEur: c.stripeFijoEur,
            activo: c.activo,
          })),
        ),
      );
      this.guardadoMsg.set(true);
      setTimeout(() => this.guardadoMsg.set(false), 3000);
    } catch {
      this.errorMsg.set('Error al guardar las comisiones. Inténtalo de nuevo.');
    }
  }
}
