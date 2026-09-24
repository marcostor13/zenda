import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BusquedaTransportesRespuesta, MODALIDAD_TRANSPORTE_LABELS, resumenSolicitudViaje,
} from 'shared';
import { OpcionElegible, RsOpcionesComponent } from '../../../../shared/components/opciones/rs-opciones.component';
import { RsResumenViajeComponent } from '../../../../shared/components/resumen-viaje/rs-resumen-viaje.component';
import { RsDesglosePrecioComponent } from '../../../../shared/components/desglose-precio/rs-desglose-precio.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { EurosPipe } from '../../../../shared/pipes/euros.pipe';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { mensajeDeError } from '../../../../shared/mensaje-error';
import { TransporteViajeApi } from '../transporte-viaje.api';
import { TransporteViajeStore } from '../transporte-viaje.store';
import { ICONO_INCLUIDO, etiquetaIncluido } from '../transporte-viaje.opciones';
import { detallesDelViaje, lugarCorto } from '../transporte-viaje.formato';

/**
 * Panel de precio de la ficha de un transportista (diapositiva 06).
 *
 * Con un viaje ya descrito, enseña el precio cerrado de **ese** viaje con esta
 * empresa, lo que incluye, el desglose por conceptos y la política de
 * cancelación. Sin viaje, invita a describirlo: la ficha ya no anuncia un
 * «desde X + tarifa por km» que el cliente tenía que calcular a mano.
 */
@Component({
  selector: 'app-cotizacion-ficha',
  standalone: true,
  imports: [
    ReactiveFormsModule, RsOpcionesComponent, RsResumenViajeComponent, RsDesglosePrecioComponent, RsIconComponent,
    EurosPipe, TraducirPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="cf rs-card">
  @if (!hayViaje()) {
    <p class="rs-label-caps cf__ante">{{ 'Precio cerrado' | t }}</p>
    <h2 class="cf__titulo">{{ 'Calcula tu precio' | t }}</h2>
    <p class="cf__texto">{{ 'Dinos de dónde a dónde, cuándo y quién viaja, y te damos el precio final con este transportista. Sin sorpresas.' | t }}</p>
    <button type="button" class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg" (click)="describirViaje()">
      {{ 'Calcular precio' | t }} <rs-icon name="arrow-right" [size]="18" [stroke]="2.2"></rs-icon>
    </button>
  } @else if (cargando()) {
    <div class="rs-skeleton cf__cargando"></div>
  } @else {
    <rs-resumen-viaje [origen]="origen()" [destino]="destino()" [detalles]="detalles()" (modificar)="describirViaje()" />

    @if (error()) {
      <div class="rs-alert rs-alert--warning">{{ error() }}</div>
    } @else if (elegido(); as r) {
      @if (opcionesModalidad().length > 1) {
        <rs-opciones [formControl]="modalidad" leyenda="Modalidad" variante="segmento" [opciones]="opcionesModalidad()" />
      }

      @if (r.incluidos.length) {
        <div>
          <p class="cf__subtitulo">{{ 'Incluido en el precio' | t }}</p>
          <ul class="cf__incluidos">
            @for (inc of r.incluidos; track inc) {
              <li><rs-icon [name]="icono(inc)" [size]="15" [stroke]="2"></rs-icon>{{ etiquetaIncluido(inc) | t }}</li>
            }
          </ul>
        </div>
      }

      @if (r.estado === 'precio') {
        <rs-desglose-precio [lineas]="r.desglose" [viajes]="viajes()" />
        <p class="cf__cerrado"><rs-icon name="shield-check" [size]="15" [stroke]="2"></rs-icon>
          {{ 'Precio cerrado: sólo cambiaría si pides extras más tarde.' | t }}</p>
      } @else {
        <div class="rs-alert rs-alert--info">{{ (r.motivoPresupuesto || 'Este viaje se presupuesta a medida.') | t }}</div>
      }

      <details class="cf__politica">
        <summary>{{ 'Política de cancelación' | t }} · <span>{{ 'Ver política' | t }}</span></summary>
        <p>{{ politica() }}</p>
      </details>

      @if (avisoPresupuesto()) { <div class="rs-alert rs-alert--success">{{ avisoPresupuesto() }}</div> }

      <div class="cf__cta">
        @if (r.estado === 'precio') {
          <button type="button" class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg" (click)="continuar()">
            {{ 'Continuar con la reserva · {total}' | t: { total: (r.total * viajes() | euros) } }}
          </button>
        } @else {
          <button type="button" class="rs-btn rs-btn--gold rs-btn--block rs-btn--lg" [disabled]="pidiendo()" (click)="pedirPresupuesto()">
            {{ 'Solicitar presupuesto' | t }}
          </button>
        }
      </div>
    }
  }
</div>

<!-- Barra fija en móvil y tableta: el panel queda al final de la ficha. -->
@if (hayViaje() && elegido(); as r) {
  <div class="cf-movil">
    @if (r.estado === 'precio') {
      <div class="cf-movil__precio"><span>{{ 'Total' | t }}</span><strong>{{ r.total * viajes() | euros }}</strong></div>
      <button type="button" class="rs-btn rs-btn--gold rs-btn--lg" (click)="continuar()">{{ 'Continuar con la reserva' | t }}</button>
    } @else {
      <button type="button" class="rs-btn rs-btn--gold rs-btn--lg rs-btn--block" [disabled]="pidiendo()" (click)="pedirPresupuesto()">{{ 'Solicitar presupuesto' | t }}</button>
    }
  </div>
} @else {
  <div class="cf-movil">
    <div class="cf-movil__precio"><span>{{ 'Precio cerrado' | t }}</span><strong class="cf-movil__calcula">{{ 'Calcúlalo en 1 minuto' | t }}</strong></div>
    <button type="button" class="rs-btn rs-btn--gold rs-btn--lg" (click)="describirViaje()">{{ 'Calcular precio' | t }}</button>
  </div>
}
  `,
  styles: [`
    :host { display: block; }
    .cf { display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-5); }
    .cf__ante { margin: 0; color: var(--dk-gold-text); }
    .cf__titulo { margin: 0; font-family: var(--font-display); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--dk-blue-text); }
    .cf__texto { margin: 0; font-size: var(--f-sm); color: var(--t-300); }
    .cf__cargando { height: 280px; border-radius: var(--r-lg); }
    .cf__subtitulo { margin: 0 0 var(--sp-2); font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200); }
    .cf__incluidos { display: flex; flex-direction: column; gap: var(--sp-1); margin: 0; padding: 0; list-style: none;
      li { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--f-sm); color: var(--t-300); }
      rs-icon { color: var(--dk-blue); }
    }
    .cf__cerrado { display: flex; gap: var(--sp-2); margin: 0; font-size: var(--f-xs); color: var(--t-300); }
    .cf__politica { font-size: var(--f-sm); color: var(--t-300);
      summary { cursor: pointer; font-weight: var(--w-6); color: var(--t-200); span { color: var(--c-accent); } }
      p { margin: var(--sp-2) 0 0; }
    }
    .cf-movil { display: none; }
    @media (max-width: 1024px) {
      .cf__cta { display: none; }
      .cf-movil {
        display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4);
        position: fixed; inset: auto 0 var(--dk-nav-inferior-h, 0px) 0; z-index: var(--z-2);
        padding: var(--sp-3) var(--sp-5) calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
        background: var(--c-card); border-top: 1px solid var(--b-1); box-shadow: 0 -8px 24px rgba(8, 37, 139, .10);
      }
      :host-context(.dk-nativo) .cf-movil { padding-bottom: var(--sp-3); }
      .cf-movil__precio { display: flex; flex-direction: column; line-height: 1.25;
        span { font-size: var(--f-xs); color: var(--t-400); }
        strong { font-family: var(--font-display); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--dk-blue-text); }
      }
      .cf-movil__calcula { font-size: var(--f-sm) !important; }
    }
  `],
})
export class CotizacionFichaComponent implements OnInit {
  private readonly store = inject(TransporteViajeStore);
  private readonly api = inject(TransporteViajeApi);
  private readonly router = inject(Router);
  private readonly rutaActiva = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly servicioId = input.required<string>();
  readonly titulo = input.required<string>();

  readonly respuesta = signal<BusquedaTransportesRespuesta | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly pidiendo = signal(false);
  readonly avisoPresupuesto = signal<string | null>(null);
  readonly modalidad = new FormControl<string>('', { nonNullable: true });
  private readonly modalidadElegida = signal('');

  readonly hayViaje = computed(() => !!this.store.solicitud());
  readonly origen = computed(() => lugarCorto(this.store.borrador().origen?.texto));
  readonly destino = computed(() => lugarCorto(this.store.borrador().destino?.texto));
  readonly detalles = computed(() => detallesDelViaje(this.store.borrador(), this.store.mascotasDelViaje(), this.i18n));
  readonly viajes = computed(() => this.respuesta()?.viajes ?? 1);

  readonly opcionesModalidad = computed<OpcionElegible[]>(() => (this.respuesta()?.resultados ?? []).map((r) => ({
    valor: r.modalidad, etiqueta: MODALIDAD_TRANSPORTE_LABELS[r.modalidad],
  })));

  readonly elegido = computed(() => {
    const resultados = this.respuesta()?.resultados ?? [];
    return resultados.find((r) => r.modalidad === this.modalidadElegida()) ?? resultados[0] ?? null;
  });

  readonly politica = computed(() => {
    const p = this.elegido()?.cancelacion;
    if (!p) return '';
    return p.reembolsoTardioPct > 0
      ? this.i18n.t('Cancelación gratuita hasta {h} h antes de la recogida. Después se devuelve el {pct} %.', { h: p.gratisHastaHoras, pct: p.reembolsoTardioPct })
      : this.i18n.t('Cancelación gratuita hasta {h} h antes de la recogida. Después no hay reembolso.', { h: p.gratisHastaHoras });
  });

  constructor() {
    this.modalidad.valueChanges.pipe(takeUntilDestroyed()).subscribe((m) => this.modalidadElegida.set(m));
  }

  ngOnInit(): void {
    const pedida = this.rutaActiva.snapshot.queryParamMap.get('modalidad') ?? this.store.borrador().modalidad;
    this.modalidad.setValue(pedida);
    if (this.hayViaje()) void this.cotizar();
  }

  icono(incluido: string): string {
    return ICONO_INCLUIDO[incluido] ?? 'check';
  }

  etiquetaIncluido(incluido: string): string {
    return etiquetaIncluido(incluido);
  }

  describirViaje(): void {
    void this.router.navigate(['/transporte']);
  }

  continuar(): void {
    const r = this.elegido();
    if (!r) return;
    this.store.elegir({ servicioId: r.servicioId, comercioId: r.comercioId, titulo: this.titulo(), modalidad: r.modalidad, total: r.total });
    void this.router.navigate(['/transporte/viaje/reserva']);
  }

  async pedirPresupuesto(): Promise<void> {
    const solicitud = this.store.solicitud();
    if (!solicitud) return;
    if (!this.auth.estaAutenticado()) {
      void this.router.navigate(['/auth/login'], { queryParams: { volverA: `/transporte/${this.servicioId()}` } });
      return;
    }
    this.pidiendo.set(true);
    try {
      const conModalidad = { ...solicitud, modalidad: this.elegido()?.modalidad ?? solicitud.modalidad };
      await this.api.pedirPresupuesto({
        servicioIds: [this.servicioId()], solicitud: conModalidad, resumen: resumenSolicitudViaje(conModalidad),
      });
      this.avisoPresupuesto.set(this.i18n.t('Solicitud enviada. Te avisaremos en cuanto respondan.'));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No se pudo enviar la solicitud de presupuesto.'));
    } finally {
      this.pidiendo.set(false);
    }
  }

  private async cotizar(): Promise<void> {
    const solicitud = this.store.solicitud();
    if (!solicitud) return;
    this.cargando.set(true);
    try {
      const respuesta = await this.api.cotizarEmpresa(this.servicioId(), solicitud);
      this.respuesta.set(respuesta);
      if (!respuesta.resultados.length) this.error.set(respuesta.motivo ?? this.i18n.t('Este transportista no cubre ese viaje.'));
    } catch (error) {
      this.error.set(mensajeDeError(error, 'No hemos podido calcular el precio de este viaje.'));
    } finally {
      this.cargando.set(false);
    }
  }
}
