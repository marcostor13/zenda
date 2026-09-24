import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SolicitudViaje } from 'shared';
import { MarcoViajeComponent } from '../componentes/marco-viaje.component';
import { SeguimientoViajeComponent } from '../componentes/seguimiento-viaje.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../../../shared/pipes/euros.pipe';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { descargarIcs } from '../../../../shared/calendario/descargar-ics';
import { ReservaApi, ReservasService } from '../../../reservas/services/reservas.service';
import { PagoEnCursoService } from '../../../reservas/services/pago-en-curso.service';
import { lugarCorto } from '../transporte-viaje.formato';

/** Tras volver del banco (3-D Secure) el webhook puede tardar: se reintenta unas veces. */
const REINTENTOS = 4;
const MS_ENTRE_REINTENTOS = 2500;

/**
 * Pantalla 6 (diapositiva 09): viaje confirmado, código de reserva, acciones
 * (ver reserva, contactar, añadir al calendario) y el estado del viaje.
 * Es también la `return_url` de Stripe cuando la tarjeta pide autenticación.
 */
@Component({
  selector: 'app-confirmada-viaje',
  standalone: true,
  imports: [RouterLink, MarcoViajeComponent, SeguimientoViajeComponent, RsIconComponent, EurosPipe, FechaPipe, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-marco-viaje [titulo]="titulo()" [subtitulo]="subtitulo()">
  @if (cargando()) {
    <div class="rs-skeleton cv__cargando"></div>
  } @else if (reserva(); as r) {
    <section class="cv__tarjeta">
      <span class="cv__check" [class.cv__check--espera]="pendiente()" aria-hidden="true">
        <rs-icon [name]="pendiente() ? 'hourglass' : 'check'" [size]="34" [stroke]="2.6"></rs-icon>
      </span>
      <p class="cv__codigo-etiqueta">{{ 'Código de reserva' | t }}</p>
      <p class="cv__codigo">{{ r.codigo }}</p>

      <dl class="cv__resumen">
        <div><dt>{{ 'Ruta' | t }}</dt><dd>{{ ruta() }}</dd></div>
        <div><dt>{{ 'Recogida' | t }}</dt><dd>{{ r.fechaInicio | date: 'EEEE d MMM · HH:mm' }}</dd></div>
        @if (r.servicioTitulo) { <div><dt>{{ 'Transportista' | t }}</dt><dd>{{ r.servicioTitulo }}</dd></div> }
        <div><dt>{{ 'Total pagado' | t }}</dt><dd>{{ r.montoTotal | euros }}</dd></div>
      </dl>

      <div class="cv__acciones">
        <a class="rs-btn rs-btn--primary rs-btn--block" [routerLink]="['/reservas', r.codigo]">{{ 'Ver mi reserva' | t }}</a>
        <button type="button" class="rs-btn rs-btn--outline rs-btn--block" (click)="calendario(r)">
          <rs-icon name="calendar-plus" [size]="16" [stroke]="2"></rs-icon> {{ 'Añadir al calendario' | t }}
        </button>
      </div>
      <p class="cv__aviso">{{ 'Te avisaremos cuando el transportista esté de camino.' | t }}</p>
    </section>

    <section class="cv__tarjeta cv__tarjeta--izq">
      <app-seguimiento-viaje [reserva]="r" />
    </section>

    <a class="cv__mas" routerLink="/reservas/mis-reservas">{{ 'Ver todas mis reservas' | t }} <rs-icon name="arrow-right" [size]="14" [stroke]="2"></rs-icon></a>
  } @else {
    <div class="rs-alert rs-alert--warning">{{ 'No encontramos esta reserva. Revisa «Mis reservas».' | t }}</div>
  }
</app-marco-viaje>
  `,
  styles: [`
    :host { display: block; }
    .cv__cargando { height: 420px; border-radius: var(--r-2xl); }
    .cv__tarjeta {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-5);
      padding: var(--sp-6) var(--sp-5); background: var(--c-card); border: 1px solid var(--b-2);
      border-radius: var(--r-2xl); box-shadow: var(--sh-md); text-align: center;
    }
    .cv__tarjeta--izq { align-items: stretch; text-align: left; }
    .cv__check {
      display: grid; place-items: center; width: 72px; height: 72px; border-radius: var(--r-full);
      background: var(--dk-blue); color: var(--c-card); box-shadow: 0 0 0 8px var(--c-accent-lo);
    }
    .cv__check--espera { background: var(--dk-gold); color: var(--dk-blue-deep); box-shadow: 0 0 0 8px var(--dk-gold-lo); }
    .cv__codigo-etiqueta { margin: var(--sp-2) 0 0; font-size: var(--f-xs); color: var(--t-400); }
    .cv__codigo { margin: 0; font-family: var(--font-display); font-size: var(--f-2xl); font-weight: var(--w-8); color: var(--dk-blue-text); letter-spacing: .02em; }
    .cv__resumen { width: 100%; display: flex; flex-direction: column; gap: var(--sp-2); margin: var(--sp-2) 0 0; text-align: left;
      div { display: flex; justify-content: space-between; gap: var(--sp-3); font-size: var(--f-sm); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--b-1); }
      dt { color: var(--t-400); }
      dd { margin: 0; color: var(--t-100); text-align: right; }
    }
    .cv__acciones { width: 100%; display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); }
    .cv__aviso { margin: 0; font-size: var(--f-xs); color: var(--t-400); }
    .cv__mas { display: inline-flex; align-items: center; gap: var(--sp-1); font-weight: var(--w-6); color: var(--c-accent); }
  `],
})
export class ConfirmadaViajeComponent implements OnInit {
  private readonly rutaActiva = inject(ActivatedRoute);
  private readonly reservas = inject(ReservasService);
  private readonly pagoEnCurso = inject(PagoEnCursoService);

  readonly reserva = signal<ReservaApi | null>(null);
  readonly cargando = signal(true);

  readonly pendiente = computed(() => {
    const r = this.reserva();
    return !r || r.estado === 'pendiente' || r.aceptacion?.estado === 'pendiente';
  });
  readonly titulo = computed(() => (this.pendiente() ? '¡Reserva recibida!' : '¡Tu reserva está confirmada!'));
  readonly subtitulo = computed(() => (this.pendiente()
    ? 'El transportista tiene que confirmar el viaje. Te avisamos en cuanto lo haga.'
    : 'Y sigue el viaje en tiempo real.'));
  readonly ruta = computed(() => {
    const solicitud = this.reserva()?.detalle?.['solicitud'] as SolicitudViaje | undefined;
    return solicitud ? `${lugarCorto(solicitud.origen.texto)} → ${lugarCorto(solicitud.destino.texto)}` : '';
  });

  async ngOnInit(): Promise<void> {
    const codigo = this.rutaActiva.snapshot.paramMap.get('codigo') ?? '';
    // Si se vuelve del banco, el pago quedó anotado: se cierra contra el servidor.
    await this.pagoEnCurso.cerrarPendiente();
    for (let intento = 0; intento < REINTENTOS; intento++) {
      const reserva = await this.reservas.obtenerPorCodigo(codigo).catch(() => null);
      this.reserva.set(reserva);
      if (!reserva || reserva.estado !== 'pendiente') break;
      await new Promise((resolver) => setTimeout(resolver, MS_ENTRE_REINTENTOS));
    }
    this.cargando.set(false);
  }

  calendario(r: ReservaApi): void {
    descargarIcs({
      uid: r.codigo,
      titulo: `Transporte de mascota · ${this.ruta()}`,
      inicio: new Date(r.fechaInicio),
      lugar: (r.detalle?.['origen'] as string | undefined) ?? '',
      descripcion: `Reserva ${r.codigo}`,
    });
  }
}
