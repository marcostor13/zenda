import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReservaEstado, VERTICAL_LABELS, VerticalKey } from 'shared';
import { RsNavbarComponent } from '../../../shared/components/navbar/rs-navbar.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { ReservaApi, ReservasService } from '../services/reservas.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { EurosPipe } from '../../../shared/pipes/euros.pipe';

/** Cómo se muestra cada estado; el color comunica más rápido que el texto. */
const ESTADOS: Record<string, { label: string; tono: 'ok' | 'aviso' | 'malo' | 'neutro' }> = {
  [ReservaEstado.PENDIENTE]: { label: 'Pendiente de pago', tono: 'aviso' },
  [ReservaEstado.CONFIRMADA]: { label: 'Confirmada', tono: 'ok' },
  [ReservaEstado.AJUSTE_SOLICITADO]: { label: 'Cambio de importe pendiente', tono: 'aviso' },
  [ReservaEstado.EN_CURSO]: { label: 'En curso', tono: 'ok' },
  [ReservaEstado.COMPLETADA]: { label: 'Completada', tono: 'neutro' },
  [ReservaEstado.CANCELADA]: { label: 'Cancelada', tono: 'malo' },
  [ReservaEstado.NO_SHOW]: { label: 'No presentado', tono: 'malo' },
  [ReservaEstado.EN_DISPUTA]: { label: 'En revisión', tono: 'aviso' },
  [ReservaEstado.REEMBOLSADA]: { label: 'Reembolsada', tono: 'neutro' },
};

/**
 * "Mi viaje con mi mascota" (HU-037): todo el viaje en una sola vista.
 *
 * Muestra cada servicio con su estado propio porque **lo son**: un viaje con el
 * hotel confirmado y la peluquería cancelada es una situación normal, no una
 * inconsistencia, y la pantalla tiene que hacerlo evidente.
 */
@Component({
  selector: 'app-mi-viaje',
  standalone: true,
  imports: [
    TraducirPipe, EurosPipe, DatePipe, RouterLink, RsNavbarComponent, RsIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="mv-page">
  <rs-navbar />

  <div class="rs-wrap rs-wrap--lg mv-wrap">
    <a routerLink="/reservas" class="back-link">
      <rs-icon name="arrow-left" [size]="15" [stroke]="2"></rs-icon> {{ 'Mis reservas' | t }}
    </a>

    @if (cargando()) {
      <p class="mv-cargando">{{ 'Cargando tu viaje…' | t }}</p>
    } @else if (error()) {
      <div class="rs-alert rs-alert--error">{{ error() }}</div>
    } @else {
      <header class="mv-head">
        <p class="mv-eyebrow">{{ 'Mi viaje con mi mascota' | t }}</p>
        <h1>{{ titulo() }}</h1>
        <p class="mv-sub">
          {{ reservas().length }} {{ reservas().length === 1 ? 'servicio' : 'servicios' }} ·
          {{ totalConfirmado() | euros }} en reservas activas
        </p>
      </header>

      <ol class="mv-timeline">
        @for (r of reservas(); track idDe(r)) {
          <li class="mv-item" [class.is-cancelada]="esCancelada(r)" [attr.data-id]="idDe(r)">
            <div class="mv-item__fecha">
              <strong>{{ r.fechaInicio | date: 'd' }}</strong>
              <span>{{ r.fechaInicio | date: 'MMM' }}</span>
            </div>

            <div class="mv-item__cuerpo">
              <div class="mv-item__cabecera">
                <span class="mv-vertical">{{ etiquetaVertical(r.vertical) }}</span>
                <span class="mv-estado" [attr.data-tono]="tono(r)">{{ etiquetaEstado(r) }}</span>
              </div>

              <h2>{{ r.servicioTitulo ?? 'Servicio reservado' }}</h2>

              <dl class="mv-datos">
                <div>
                  <dt>{{ 'Cuándo' | t }}</dt>
                  <dd>
                    {{ r.fechaInicio | date: 'd MMM, HH:mm' }}@if (r.fechaFin) { → {{ r.fechaFin | date: 'd MMM, HH:mm' }} }
                  </dd>
                </div>
                <div>
                  <dt>{{ 'Código' | t }}</dt>
                  <dd>{{ r.codigo }}</dd>
                </div>
                <div>
                  <dt>{{ 'Importe' | t }}</dt>
                  <dd>{{ r.montoTotal | euros }}</dd>
                </div>
              </dl>

              <div class="mv-item__acciones">
                <a [routerLink]="['/reservas', r.codigo]" class="rs-btn rs-btn--outline rs-btn--sm">
                  {{ 'Ver detalle' | t }}
                </a>
                @if (puedeCancelar(r)) {
                  <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                          [disabled]="cancelandoId() === idDe(r)" (click)="cancelar(r)">
                    {{ cancelandoId() === r._id ? 'Cancelando…' : 'Cancelar solo este' }}
                  </button>
                }
              </div>
            </div>
          </li>
        }
      </ol>

      <p class="mv-nota">
        <rs-icon name="alert-circle" [size]="14" [stroke]="2"></rs-icon>
        {{ 'Cancelar un servicio no afecta a los demás: cada uno tiene su propia política de cancelación.' | t }}
      </p>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; }
    .mv-page { min-height: 100vh; min-height: 100dvh; background: var(--c-base); }
    .mv-wrap { padding-block: var(--sp-8); }

    .back-link {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      color: var(--t-400); font-size: var(--f-sm); text-decoration: none; margin-bottom: var(--sp-4);
    }

    .mv-cargando { color: var(--t-400); }

    .mv-head { margin-bottom: var(--sp-8); }
    .mv-eyebrow {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .12em; text-transform: uppercase; color: var(--dk-gold);
      margin-bottom: var(--sp-2);
    }
    .mv-head h1 { font-size: var(--f-2xl); color: var(--dk-blue); }
    .mv-sub { color: var(--t-400); margin-top: var(--sp-2); }

    .mv-timeline { list-style: none; display: flex; flex-direction: column; gap: var(--sp-4); }

    .mv-item {
      display: flex; gap: var(--sp-5);
      padding: var(--sp-5);
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-xl);

      &.is-cancelada { opacity: .62; }
      @media (max-width: 560px) { flex-direction: column; gap: var(--sp-3); }
    }

    .mv-item__fecha {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 62px; height: 62px; flex-shrink: 0;
      border-radius: var(--r-lg);
      background: var(--c-accent-lo); color: var(--dk-blue);

      strong { font-size: var(--f-xl); line-height: 1; }
      span { font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .04em; }
    }

    .mv-item__cuerpo { flex: 1; min-width: 0; }

    .mv-item__cabecera {
      display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
      margin-bottom: var(--sp-1);
    }

    .mv-vertical {
      font-family: var(--font-accent); font-size: var(--f-xs); font-weight: var(--w-7);
      letter-spacing: .06em; text-transform: uppercase; color: var(--dk-gold);
    }

    .mv-estado {
      padding: 1px var(--sp-2); border-radius: var(--r-full);
      font-size: var(--f-xs); font-weight: var(--w-6);

      &[data-tono="ok"]     { background: rgba(22,163,74,.12); color: #15803D; }
      &[data-tono="aviso"]  { background: rgba(251,174,23,.18); color: #92600A; }
      &[data-tono="malo"]   { background: rgba(185,28,28,.10); color: #B91C1C; }
      &[data-tono="neutro"] { background: var(--c-surface, rgba(5,26,102,.06)); color: var(--t-300); }
    }

    .mv-item__cuerpo h2 { font-size: var(--f-md); color: var(--t-100); margin-bottom: var(--sp-3); }

    .mv-datos {
      display: flex; gap: var(--sp-6); flex-wrap: wrap; margin-bottom: var(--sp-4);
      dt { font-size: var(--f-xs); color: var(--t-400); margin-bottom: 2px; }
      dd { font-size: var(--f-sm); color: var(--t-200); font-weight: var(--w-6); }
    }

    .mv-item__acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

    .mv-nota {
      display: flex; align-items: center; gap: var(--sp-2);
      margin-top: var(--sp-6); font-size: var(--f-xs); color: var(--t-400);
    }
  `],
})
export class MiViajeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reservasService = inject(ReservasService);

  readonly reservas = signal<ReservaApi[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly cancelandoId = signal<string | null>(null);

  readonly titulo = computed(() => {
    const primera = this.reservas()[0];
    return primera?.servicioTitulo ?? 'Tu viaje';
  });

  /** Solo cuenta lo que sigue vivo: lo cancelado ya no es dinero comprometido. */
  readonly totalConfirmado = computed(() =>
    Math.round(
      this.reservas()
        .filter((r) => !this.esCancelada(r))
        .reduce((suma, r) => suma + r.montoTotal, 0) * 100,
    ) / 100,
  );

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('reservaMadreId') ?? '';
    try {
      this.reservas.set(await this.reservasService.viaje(id));
    } catch {
      this.error.set('No se pudo cargar el viaje. Vuelve a intentarlo.');
    } finally {
      this.cargando.set(false);
    }
  }

  etiquetaVertical(vertical: string): string {
    return VERTICAL_LABELS[vertical as VerticalKey] ?? vertical;
  }

  etiquetaEstado(reserva: ReservaApi): string {
    return ESTADOS[reserva.estado]?.label ?? reserva.estado;
  }

  tono(reserva: ReservaApi): string {
    return ESTADOS[reserva.estado]?.tono ?? 'neutro';
  }

  /** El API devuelve `_id` o `id` según la vista; ambos son el mismo valor. */
  idDe(reserva: ReservaApi): string {
    return reserva._id ?? reserva.id ?? '';
  }

  esCancelada(reserva: ReservaApi): boolean {
    return reserva.estado === ReservaEstado.CANCELADA || reserva.estado === ReservaEstado.REEMBOLSADA;
  }

  puedeCancelar(reserva: ReservaApi): boolean {
    return reserva.estado === ReservaEstado.PENDIENTE || reserva.estado === ReservaEstado.CONFIRMADA;
  }

  async cancelar(reserva: ReservaApi): Promise<void> {
    const id = this.idDe(reserva);
    this.cancelandoId.set(id);
    try {
      await this.reservasService.cancelar(id);
      // Solo cambia la línea cancelada: el resto del viaje sigue igual (HU-035).
      this.reservas.update((lista) =>
        lista.map((r) => (this.idDe(r) === id ? { ...r, estado: ReservaEstado.CANCELADA } : r)),
      );
    } catch {
      this.error.set(`No se pudo cancelar ${reserva.servicioTitulo ?? 'el servicio'}.`);
    } finally {
      this.cancelandoId.set(null);
    }
  }
}
