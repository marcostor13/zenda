import {
  ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal,
} from '@angular/core';
import {
  HITO_VIAJE_LABELS, HITOS_VIAJE_ORDEN, HitoViaje, ReservaEstado, UbicacionViajeRespuesta, normalizarHitoViaje,
} from 'shared';
import { PasoTimeline, RsTimelineViajeComponent } from '../../../../shared/components/timeline-viaje/rs-timeline-viaje.component';
import { PuntoMapa, RsMapaComponent } from '../../../../shared/components/mapa/rs-mapa.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FechaPipe } from '../../../../shared/pipes/fecha.pipe';
import { esNavegador } from '../../../../core/plataforma/almacen';
import { ReservaApi } from '../../../reservas/services/reservas.service';
import { ContactoReserva, TransporteViajeApi } from '../transporte-viaje.api';

/** Cada cuánto se pregunta dónde va el vehículo mientras el mapa está abierto. */
const SEGUNDOS_ENTRE_CONSULTAS = 10;

const ESTADOS_VIVOS: readonly string[] = [ReservaEstado.CONFIRMADA, ReservaEstado.EN_CURSO];

/**
 * Seguimiento de un viaje (diapositiva 10): estado paso a paso, contacto con
 * el transportista (llamar y WhatsApp, D2) y el vehículo en el mapa mientras
 * el conductor comparte su ubicación (D3).
 *
 * El mapa pregunta cada 10 s sólo mientras está abierto; al cerrarlo, al salir
 * de la pantalla o al entregarse la mascota deja de preguntar.
 */
@Component({
  selector: 'app-seguimiento-viaje',
  standalone: true,
  imports: [RsTimelineViajeComponent, RsMapaComponent, RsIconComponent, TraducirPipe, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<section class="sv">
  <h2 class="sv__titulo">{{ 'Estado del viaje' | t }}</h2>

  @if (reserva().aceptacion?.estado === 'pendiente') {
    <div class="rs-alert rs-alert--warning sv__aceptacion">
      <rs-icon name="hourglass" [size]="16" [stroke]="2"></rs-icon>
      <span>
        {{ 'Esperando a que el transportista acepte el viaje.' | t }}
        @if (reserva().aceptacion?.venceEn) {
          {{ 'Si no lo hace antes de las {hora}, te devolvemos el dinero.' | t: { hora: (reserva().aceptacion?.venceEn | date: 'HH:mm') ?? '' } }}
        }
      </span>
    </div>
  }

  <rs-timeline-viaje [pasos]="pasos()" />

  @if (contacto(); as c) {
    <div class="sv__contacto">
      @if (c.telefono) {
        <a class="rs-btn rs-btn--outline rs-btn--sm" [href]="'tel:' + soloDigitos(c.telefono)">
          <rs-icon name="phone" [size]="15" [stroke]="2"></rs-icon> {{ 'Llamar' | t }}
        </a>
      }
      @if (c.whatsapp) {
        <a class="rs-btn rs-btn--outline rs-btn--sm" [href]="'https://wa.me/' + soloDigitos(c.whatsapp)" target="_blank" rel="noopener">
          <rs-icon name="message-square" [size]="15" [stroke]="2"></rs-icon> {{ 'WhatsApp' | t }}
        </a>
      }
    </div>
  }

  @if (puedeSeguir()) {
    @if (!mapaAbierto()) {
      <button type="button" class="rs-btn rs-btn--primary rs-btn--block" (click)="abrirMapa()">
        <rs-icon name="navigation" [size]="16" [stroke]="2"></rs-icon> {{ 'Seguir en tiempo real' | t }}
      </button>
    } @else {
      <div class="sv__mapa">
        <rs-mapa [puntos]="puntosMapa()" [ruta]="ubicacion()?.rastro ?? []" [ariaLabel]="'Ubicación del vehículo' | t" />
      </div>
      <p class="sv__estado-mapa">
        @if (ubicacion()?.compartiendo) {
          <span class="sv__vivo"></span>
          {{ 'Posición actualizada a las {hora}' | t: { hora: (ubicacion()?.posicion?.at | date: 'HH:mm') ?? '' } }}
        } @else {
          {{ 'El transportista todavía no comparte su ubicación. Te avisaremos de cada paso del viaje.' | t }}
        }
      </p>
    }
  }
  <p class="sv__nota"><rs-icon name="bell" [size]="14" [stroke]="2"></rs-icon>{{ 'Te avisaremos en cada paso del trayecto.' | t }}</p>
</section>
  `,
  styles: [`
    :host { display: block; }
    .sv { display: flex; flex-direction: column; gap: var(--sp-4); }
    .sv__titulo { margin: 0; font-family: var(--font-display); font-size: var(--f-lg); font-weight: var(--w-8); color: var(--dk-blue-text); }
    .sv__aceptacion { display: flex; gap: var(--sp-2); align-items: flex-start; }
    .sv__contacto { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .sv__mapa { height: 260px; border-radius: var(--r-xl); overflow: hidden; border: 1px solid var(--b-2); }
    .sv__mapa rs-mapa { display: block; height: 100%; }
    .sv__estado-mapa { display: flex; align-items: center; gap: var(--sp-2); margin: 0; font-size: var(--f-xs); color: var(--t-400); }
    .sv__vivo {
      width: 8px; height: 8px; border-radius: var(--r-full); background: var(--c-success);
      box-shadow: 0 0 0 4px var(--c-success-lo); animation: sv-latido 1.6s ease-in-out infinite;
    }
    @keyframes sv-latido { 50% { box-shadow: 0 0 0 7px transparent; } }
    @media (prefers-reduced-motion: reduce) { .sv__vivo { animation: none; } }
    .sv__nota { display: flex; align-items: center; gap: var(--sp-2); margin: 0; font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class SeguimientoViajeComponent implements OnInit {
  private readonly api = inject(TransporteViajeApi);
  private readonly destruir = inject(DestroyRef);
  private readonly i18n = inject(I18nService);

  readonly reserva = input.required<ReservaApi>();

  readonly contacto = signal<ContactoReserva | null>(null);
  readonly mapaAbierto = signal(false);
  readonly ubicacion = signal<UbicacionViajeRespuesta | null>(null);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  private readonly hitos = computed(() => {
    const marcados = new Map<string, { at: string; nota?: string; fotoUrl?: string }>();
    for (const h of this.reserva().seguimiento ?? []) marcados.set(normalizarHitoViaje(h.hito), h);
    return marcados;
  });

  private readonly entregada = computed(() =>
    this.hitos().has(HitoViaje.ENTREGADA) || this.hitos().has(HitoViaje.FINALIZADA));

  readonly puedeSeguir = computed(() =>
    ESTADOS_VIVOS.includes(this.reserva().estado) && this.reserva().aceptacion?.estado !== 'pendiente' && !this.entregada());

  readonly pasos = computed<PasoTimeline[]>(() => {
    const reserva = this.reserva();
    const confirmada = reserva.estado !== ReservaEstado.PENDIENTE && reserva.estado !== ReservaEstado.CANCELADA;
    const hitos = this.hitos();
    const pasos: PasoTimeline[] = [{
      clave: 'confirmada', etiqueta: 'Reserva confirmada',
      estado: confirmada ? 'hecho' : 'actual',
    }];
    let actualAsignado = !confirmada;
    // «Finalizado» no se enseña aparte: para el cliente el viaje acaba con la entrega.
    for (const hito of HITOS_VIAJE_ORDEN.filter((h) => h !== HitoViaje.FINALIZADA)) {
      const marcado = hitos.get(hito);
      const esActual = !marcado && !actualAsignado && ESTADOS_VIVOS.includes(reserva.estado);
      if (esActual) actualAsignado = true;
      pasos.push({
        clave: hito,
        etiqueta: HITO_VIAJE_LABELS[hito],
        estado: marcado ? 'hecho' : esActual ? 'actual' : 'pendiente',
        at: marcado?.at,
        nota: marcado?.nota,
        fotoUrl: marcado?.fotoUrl,
      });
    }
    return pasos;
  });

  readonly puntosMapa = computed<PuntoMapa[]>(() => {
    const u = this.ubicacion();
    const puntos: PuntoMapa[] = [];
    if (u?.origen) puntos.push({ id: 'origen', ...u.origen, titulo: this.i18n.t('Recogida') });
    if (u?.destino) puntos.push({ id: 'destino', ...u.destino, titulo: this.i18n.t('Entrega') });
    if (u?.posicion) {
      puntos.push({ id: 'vehiculo', lat: u.posicion.lat, lng: u.posicion.lng, titulo: this.i18n.t('Transportista'), vertical: 'transporte' });
    }
    return puntos;
  });

  ngOnInit(): void {
    this.destruir.onDestroy(() => this.pararConsultas());
    const id = this.idReserva();
    if (!id || ![...ESTADOS_VIVOS, ReservaEstado.COMPLETADA as string].includes(this.reserva().estado)) return;
    void this.api.contacto(id).then((c) => this.contacto.set(c)).catch(() => undefined);
  }

  soloDigitos(telefono: string): string {
    return telefono.replace(/[^\d+]/g, '').replace(/^\+/, '');
  }

  abrirMapa(): void {
    this.mapaAbierto.set(true);
    void this.consultar();
    if (esNavegador()) this.temporizador = setInterval(() => void this.consultar(), SEGUNDOS_ENTRE_CONSULTAS * 1000);
  }

  private async consultar(): Promise<void> {
    const id = this.idReserva();
    if (!id) return;
    try {
      this.ubicacion.set(await this.api.ubicacion(id));
    } catch {
      this.pararConsultas();
    }
    if (!this.puedeSeguir()) this.pararConsultas();
  }

  private pararConsultas(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  private idReserva(): string | null {
    return this.reserva()._id ?? this.reserva().id ?? null;
  }
}
