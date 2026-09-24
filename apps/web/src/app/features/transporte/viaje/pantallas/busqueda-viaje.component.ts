import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FranjaTransporte, ModoHorarioTransporte, PatronRecurrenciaTransporte, PuntoViaje, NecesidadTransporte,
  VueltaTransporte,
  hoyEnZona, viajesDeLaSolicitud,
} from 'shared';
import { MarcoViajeComponent } from '../componentes/marco-viaje.component';
import { RsOpcionesComponent } from '../../../../shared/components/opciones/rs-opciones.component';
import {
  LugarElegido, RsPlaceAutocompleteComponent,
} from '../../../../shared/components/place-autocomplete/rs-place-autocomplete.component';
import { PuntoMapa, RsMapaComponent } from '../../../../shared/components/mapa/rs-mapa.component';
import { RsBarraCtaComponent } from '../../../../shared/components/barra-cta/rs-barra-cta.component';
import { RsIconComponent } from '../../../../shared/components/icon/rs-icon.component';
import { RsTrustBlockComponent, TrustItem } from '../../../../shared/components/trust-block/rs-trust-block.component';
import { TraducirPipe } from '../../../../core/i18n/traducir.pipe';
import { GeoService, Trayecto } from '../../../../core/geo/geo.service';
import { esNavegador } from '../../../../core/plataforma/almacen';
import { TransporteViajeStore, puntoValido } from '../transporte-viaje.store';
import { textoDuracion } from '../transporte-viaje.formato';
import {
  OPCIONES_DIAS_SEMANA, OPCIONES_FRANJA, OPCIONES_MODO_HORARIO, OPCIONES_PATRON, OPCIONES_TIPO_SERVICIO,
  OPCIONES_VUELTA,
} from '../transporte-viaje.opciones';

/** Horas en pasos de 15 minutos, de 00:00 a 23:45. */
const HORAS: readonly string[] = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

const CONFIANZA: TrustItem[] = [
  { icon: 'shield-check', label: 'Transportes verificados' },
  { icon: 'lock', label: 'Pago seguro' },
  { icon: 'navigation', label: 'Seguimiento del viaje' },
  { icon: 'headphones', label: 'Atención al cliente' },
];

/**
 * Pantalla 1 del flujo de Transporte (diapositivas 01 y 02, pantalla 1 del
 * mockup): qué tipo de viaje, de dónde a dónde y cuándo. Todo en una pantalla;
 * lo condicional (franjas, vuelta, repetición) sólo aparece cuando aplica.
 */
@Component({
  selector: 'app-busqueda-viaje',
  standalone: true,
  imports: [
    ReactiveFormsModule, MarcoViajeComponent, RsOpcionesComponent, RsPlaceAutocompleteComponent, RsMapaComponent,
    RsBarraCtaComponent, RsIconComponent, RsTrustBlockComponent, TraducirPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<app-marco-viaje [paso]="1" antetitulo="Transporte de mascotas" titulo="¿A dónde llevamos a tu rey?"
                 subtitulo="Cuéntanos el viaje y te enseñamos el precio final de cada transportista.">
  <form class="bv" [formGroup]="form" (ngSubmit)="continuar()" novalidate>
    <section class="bv__bloque">
      <rs-opciones formControlName="tipo" leyenda="¿Qué tipo de servicio necesitas?" [opciones]="opcionesTipo" [columnas]="3" />
    </section>

    <section class="bv__bloque bv__ruta">
      <div class="rs-field">
        <label class="rs-lbl" for="viaje-origen">{{ 'Origen' | t }}</label>
        <rs-place-autocomplete formControlName="origenTexto" inputId="viaje-origen" tipo="direccion" apariencia="campo"
                               [catalogoLocal]="[]" [sugerenciasIniciales]="0"
                               [placeholder]="'Calle y número de recogida' | t"
                               (lugarElegido)="elegirPunto('origen', $event)" />
        <button type="button" class="bv__ubicacion" (click)="usarMiUbicacion()" [disabled]="localizando()">
          <rs-icon name="locate" [size]="15" [stroke]="2"></rs-icon>
          {{ (localizando() ? 'Buscando tu ubicación…' : 'Usar mi ubicación') | t }}
        </button>
        @if (intento() && !origenValido()) {
          <p class="rs-field-err">{{ 'Elige la dirección de recogida de la lista.' | t }}</p>
        }
      </div>

      <button type="button" class="bv__intercambiar" (click)="intercambiar()" [attr.aria-label]="'Intercambiar origen y destino' | t">
        <rs-icon name="arrow-up-down" [size]="18" [stroke]="2"></rs-icon>
      </button>

      <div class="rs-field">
        <label class="rs-lbl" for="viaje-destino">{{ 'Destino' | t }}</label>
        <rs-place-autocomplete formControlName="destinoTexto" inputId="viaje-destino" tipo="direccion" apariencia="campo"
                               [catalogoLocal]="[]" [sugerenciasIniciales]="0"
                               [placeholder]="'Calle y número de entrega' | t"
                               (lugarElegido)="elegirPunto('destino', $event)" />
        @if (intento() && !destinoValido()) {
          <p class="rs-field-err">{{ 'Elige la dirección de entrega de la lista.' | t }}</p>
        }
      </div>

      @if (trayecto(); as t) {
        <div class="bv__distancia" role="status">
          <rs-icon name="route" [size]="16" [stroke]="2"></rs-icon>
          <span>{{ '≈ {km} km · {tiempo} por carretera' | t: { km: t.km, tiempo: duracion(t.duracionMin) } }}</span>
          <button type="button" class="bv__ver-mapa" (click)="mapaAbierto.set(!mapaAbierto())">
            {{ (mapaAbierto() ? 'Ocultar mapa' : 'Ver en el mapa') | t }}
          </button>
        </div>
      }
      @if (mapaAbierto() && puntosMapa().length === 2) {
        <div class="bv__mapa">
          <rs-mapa [puntos]="puntosMapa()" [ruta]="puntosMapa()" [ariaLabel]="'Ruta del viaje' | t" />
        </div>
      }
    </section>

    <section class="bv__bloque">
      <div class="rs-field">
        <label class="rs-lbl" for="viaje-fecha">{{ (esRecurrente() ? 'Primer viaje' : 'Fecha de recogida') | t }}</label>
        <input id="viaje-fecha" class="rs-inp" type="date" formControlName="fecha" [min]="hoy" />
        @if (intento() && !form.value.fecha) { <p class="rs-field-err">{{ 'Elige el día de recogida.' | t }}</p> }
      </div>

      <rs-opciones formControlName="modoHorario" leyenda="Horario" variante="segmento" [opciones]="opcionesHorario" />

      @switch (form.value.modoHorario) {
        @case ('hora_concreta') {
          <div class="rs-field">
            <label class="rs-lbl" for="viaje-hora">{{ 'Hora de recogida' | t }}</label>
            <select id="viaje-hora" class="rs-inp" formControlName="hora">
              @for (h of horas; track h) { <option [value]="h">{{ h }}</option> }
            </select>
          </div>
        }
        @case ('flexible') {
          <rs-opciones formControlName="franja" leyenda="¿Qué franja te viene mejor?" variante="chip" [opciones]="opcionesFranja" />
        }
        @case ('lo_antes_posible') {
          <p class="bv__nota">
            <rs-icon name="zap" [size]="15" [stroke]="2"></rs-icon>
            {{ 'El transportista confirmará la hora de recogida al aceptar el viaje.' | t }}
          </p>
        }
      }
    </section>

    @if (esIdaVuelta()) {
      <section class="bv__bloque bv__condicional">
        <rs-opciones formControlName="vueltaModo" leyenda="¿Cuándo vuelve?" variante="chip" [opciones]="opcionesVuelta" />
        @switch (form.value.vueltaModo) {
          @case ('hora') {
            <div class="rs-field">
              <label class="rs-lbl" for="viaje-vuelta-hora">{{ 'Hora de vuelta' | t }}</label>
              <select id="viaje-vuelta-hora" class="rs-inp" formControlName="vueltaHora">
                @for (h of horas; track h) { <option [value]="h">{{ h }}</option> }
              </select>
            </div>
          }
          @case ('tras_horas') {
            <div class="rs-field">
              <label class="rs-lbl" for="viaje-espera">{{ 'Horas de espera' | t }}</label>
              <input id="viaje-espera" class="rs-inp" type="number" min="1" max="72" formControlName="vueltaHoras" />
            </div>
          }
          @case ('otro_dia') {
            <div class="bv__dos">
              <div class="rs-field">
                <label class="rs-lbl" for="viaje-vuelta-fecha">{{ 'Día de vuelta' | t }}</label>
                <input id="viaje-vuelta-fecha" class="rs-inp" type="date" formControlName="vueltaFecha" [min]="form.value.fecha || hoy" />
              </div>
              <div class="rs-field">
                <label class="rs-lbl" for="viaje-vuelta-hora2">{{ 'Hora' | t }}</label>
                <select id="viaje-vuelta-hora2" class="rs-inp" formControlName="vueltaHora">
                  @for (h of horas; track h) { <option [value]="h">{{ h }}</option> }
                </select>
              </div>
            </div>
            @if (intento() && !form.value.vueltaFecha) { <p class="rs-field-err">{{ 'Elige el día de vuelta.' | t }}</p> }
          }
          @case ('cuando_avise') {
            <p class="bv__nota">{{ 'Avisarás al transportista desde tu reserva cuando la mascota esté lista.' | t }}</p>
          }
        }
      </section>
    }

    @if (esRecurrente()) {
      <section class="bv__bloque bv__condicional">
        <rs-opciones formControlName="patron" leyenda="¿Cada cuánto?" variante="chip" [opciones]="opcionesPatron" />
        @if (pideDias()) {
          <rs-opciones formControlName="diasSemana" leyenda="Días" variante="segmento" [multiple]="true" [opciones]="opcionesDias" />
        }
        <div class="rs-field">
          <label class="rs-lbl" for="viaje-hasta">{{ 'Repetir hasta' | t }}</label>
          <input id="viaje-hasta" class="rs-inp" type="date" formControlName="hasta" [min]="form.value.fecha || hoy" />
          @if (intento() && !form.value.hasta) { <p class="rs-field-err">{{ 'Indica hasta cuándo se repite.' | t }}</p> }
        </div>
        @if (viajes() > 1) {
          <p class="bv__nota"><rs-icon name="repeat" [size]="15" [stroke]="2"></rs-icon>
            {{ 'Son {n} viajes. Se pagan juntos al reservar.' | t: { n: viajes() } }}</p>
        }
      </section>
    }

    <rs-barra-cta>
      <button type="submit" class="rs-btn rs-btn--gold rs-btn--lg">
        {{ 'Continuar' | t }} <rs-icon name="arrow-right" [size]="18" [stroke]="2.2"></rs-icon>
      </button>
    </rs-barra-cta>
  </form>

  <rs-trust-block class="bv__confianza" [items]="confianza" />
</app-marco-viaje>
  `,
  styles: [`
    :host { display: block; }
    .bv { display: flex; flex-direction: column; gap: var(--sp-5); }
    .bv__bloque {
      display: flex; flex-direction: column; gap: var(--sp-4);
      padding: var(--sp-5); background: var(--c-card); border: 1px solid var(--b-2);
      border-radius: var(--r-2xl); box-shadow: var(--sh-sm);
    }
    .bv__condicional { border-color: var(--dk-gold); background: linear-gradient(0deg, var(--c-card), var(--c-card)), var(--dk-gold-lo); }
    .bv__ruta { position: relative; }
    .bv__intercambiar {
      align-self: flex-end; margin: calc(var(--sp-2) * -1) 0; display: grid; place-items: center;
      width: 40px; height: 40px; border-radius: var(--r-full);
      border: 1.5px solid var(--b-2); background: var(--c-card); color: var(--dk-blue);
      &:hover { border-color: var(--dk-blue); background: var(--c-accent-lo); }
    }
    .bv__ubicacion {
      align-self: flex-start; display: inline-flex; align-items: center; gap: var(--sp-1);
      font-size: var(--f-xs); font-weight: var(--w-6); color: var(--c-accent);
      &:disabled { opacity: .6; }
    }
    .bv__distancia {
      display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--dk-blue-text); font-weight: var(--w-6);
    }
    .bv__ver-mapa { margin-left: auto; font-size: var(--f-xs); font-weight: var(--w-6); color: var(--c-accent); }
    .bv__mapa { height: 220px; border-radius: var(--r-lg); overflow: hidden; }
    .bv__mapa rs-mapa { display: block; height: 100%; }
    .bv__dos { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
    .bv__nota {
      display: flex; align-items: center; gap: var(--sp-2); margin: 0;
      font-size: var(--f-sm); color: var(--t-300);
    }
    .bv__confianza { display: block; margin-top: var(--sp-8); }
    @media (max-width: 480px) {
      .bv__bloque { padding: var(--sp-4); }
    }
  `],
})
export class BusquedaViajeComponent implements OnInit {
  private readonly store = inject(TransporteViajeStore);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly geo = inject(GeoService);

  readonly opcionesTipo = OPCIONES_TIPO_SERVICIO;
  readonly opcionesHorario = OPCIONES_MODO_HORARIO;
  readonly opcionesFranja = OPCIONES_FRANJA;
  readonly opcionesVuelta = OPCIONES_VUELTA;
  readonly opcionesPatron = OPCIONES_PATRON;
  readonly opcionesDias = OPCIONES_DIAS_SEMANA;
  readonly confianza = CONFIANZA;
  readonly horas = HORAS;
  readonly hoy = hoyEnZona();

  readonly intento = signal(false);
  readonly localizando = signal(false);
  readonly mapaAbierto = signal(false);
  readonly trayecto = signal<Trayecto | null>(null);

  readonly form = new FormGroup({
    tipo: new FormControl<string>('', { nonNullable: true }),
    origenTexto: new FormControl<string>('', { nonNullable: true }),
    destinoTexto: new FormControl<string>('', { nonNullable: true }),
    fecha: new FormControl<string>('', { nonNullable: true }),
    modoHorario: new FormControl<string>('', { nonNullable: true }),
    hora: new FormControl<string>('', { nonNullable: true }),
    franja: new FormControl<string>('', { nonNullable: true }),
    vueltaModo: new FormControl<string>('', { nonNullable: true }),
    vueltaHora: new FormControl<string>('', { nonNullable: true }),
    vueltaHoras: new FormControl<number>(2, { nonNullable: true }),
    vueltaFecha: new FormControl<string>('', { nonNullable: true }),
    patron: new FormControl<string>('', { nonNullable: true }),
    diasSemana: new FormControl<string[]>([], { nonNullable: true }),
    hasta: new FormControl<string>('', { nonNullable: true }),
  });

  private readonly borrador = this.store.borrador;
  readonly esIdaVuelta = computed(() => this.borrador().tipoServicio === NecesidadTransporte.IDA_VUELTA);
  readonly esRecurrente = computed(() => this.borrador().tipoServicio === NecesidadTransporte.RECURRENTE);
  readonly pideDias = computed(() => ![
    PatronRecurrenciaTransporte.DIARIO, PatronRecurrenciaTransporte.LABORABLES, PatronRecurrenciaTransporte.MENSUAL,
  ].includes(this.borrador().patron));
  readonly origenValido = computed(() => puntoValido(this.borrador().origen));
  readonly destinoValido = computed(() => puntoValido(this.borrador().destino));
  readonly viajes = computed(() => {
    const solicitud = this.store.solicitud();
    return solicitud ? viajesDeLaSolicitud(solicitud) : 1;
  });

  readonly puntosMapa = computed<PuntoMapa[]>(() => {
    const { origen, destino } = this.borrador();
    return [origen, destino].flatMap((p, i) => (p && p.lat !== undefined && p.lng !== undefined
      ? [{ id: i ? 'destino' : 'origen', lat: p.lat, lng: p.lng, titulo: p.texto }]
      : []));
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.volcarEnStore());
    this.form.controls.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe((tipo) => {
      this.store.elegirTipo(tipo as NecesidadTransporte);
      this.rellenarDesdeStore();
    });
    this.form.controls.origenTexto.valueChanges.pipe(takeUntilDestroyed())
      .subscribe((texto) => this.textoCambiado('origen', texto));
    this.form.controls.destinoTexto.valueChanges.pipe(takeUntilDestroyed())
      .subscribe((texto) => this.textoCambiado('destino', texto));
  }

  ngOnInit(): void {
    // Desde el buscador de la portada llegan la población de recogida y el día.
    const params = this.ruta.snapshot.queryParamMap;
    const origenSugerido = params.get('origen') ?? params.get('ciudad');
    if (origenSugerido && !this.borrador().origen) this.store.actualizar({ origen: { texto: origenSugerido } });
    const fechaSugerida = params.get('desde');
    if (fechaSugerida && /^\d{4}-\d{2}-\d{2}$/.test(fechaSugerida) && fechaSugerida >= this.hoy) {
      this.store.actualizar({ fecha: fechaSugerida });
    }
    if (!this.borrador().fecha || this.borrador().fecha < this.hoy) this.store.actualizar({ fecha: this.hoy });
    this.rellenarDesdeStore();
    void this.calcularTrayecto();
  }

  elegirPunto(cual: 'origen' | 'destino', lugar: LugarElegido): void {
    const texto = lugar.direccion?.formateada
      || [this.form.controls[cual === 'origen' ? 'origenTexto' : 'destinoTexto'].value, lugar.ciudad].filter(Boolean).join(', ');
    const punto: PuntoViaje = {
      texto,
      placeId: lugar.placeId || undefined,
      lat: Number.isFinite(lugar.lat) ? lugar.lat : undefined,
      lng: Number.isFinite(lugar.lng) ? lugar.lng : undefined,
    };
    this.store.actualizar(cual === 'origen' ? { origen: punto } : { destino: punto });
    void this.calcularTrayecto();
  }

  intercambiar(): void {
    this.store.intercambiarPuntos();
    this.rellenarDesdeStore();
    void this.calcularTrayecto();
  }

  /** La ubicación del móvil como punto de recogida; el servidor calcula la ruta con las coordenadas. */
  usarMiUbicacion(): void {
    if (!esNavegador() || !navigator.geolocation) return;
    this.localizando.set(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const direccion = await this.geo.direccionDePunto(coords.latitude, coords.longitude);
        const texto = direccion?.formateada || 'Mi ubicación';
        this.store.actualizar({ origen: { texto, lat: coords.latitude, lng: coords.longitude } });
        this.form.controls.origenTexto.setValue(texto, { emitEvent: false });
        this.localizando.set(false);
        void this.calcularTrayecto();
      },
      () => this.localizando.set(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  duracion(minutos: number): string {
    return textoDuracion(minutos);
  }

  continuar(): void {
    this.intento.set(true);
    if (!this.store.rutaCompleta()) return;
    void this.router.navigate(['/transporte/viaje/mascota']);
  }

  /** Si el cliente reescribe el texto, el punto elegido deja de valer hasta que elija otro de la lista. */
  private textoCambiado(cual: 'origen' | 'destino', texto: string): void {
    const actual = this.borrador()[cual];
    if (actual && actual.texto === texto) return;
    this.store.actualizar(cual === 'origen' ? { origen: { texto } } : { destino: { texto } });
    this.trayecto.set(null);
  }

  private volcarEnStore(): void {
    const v = this.form.getRawValue();
    this.store.actualizar({
      fecha: v.fecha,
      modoHorario: v.modoHorario as ModoHorarioTransporte,
      hora: v.hora,
      franja: v.franja as FranjaTransporte,
      vueltaModo: v.vueltaModo as VueltaTransporte,
      vueltaHora: v.vueltaHora,
      vueltaHoras: Number(v.vueltaHoras) || 1,
      vueltaFecha: v.vueltaFecha,
      patron: v.patron as PatronRecurrenciaTransporte,
      diasSemana: v.diasSemana.map(Number),
      hasta: v.hasta,
    });
  }

  private rellenarDesdeStore(): void {
    const b = this.borrador();
    this.form.patchValue({
      tipo: b.tipoServicio,
      origenTexto: b.origen?.texto ?? '',
      destinoTexto: b.destino?.texto ?? '',
      fecha: b.fecha,
      modoHorario: b.modoHorario,
      hora: b.hora,
      franja: b.franja,
      vueltaModo: b.vueltaModo,
      vueltaHora: b.vueltaHora,
      vueltaHoras: b.vueltaHoras,
      vueltaFecha: b.vueltaFecha,
      patron: b.patron,
      diasSemana: b.diasSemana.map(String),
      hasta: b.hasta,
    }, { emitEvent: false });
  }

  /** Distancia orientativa en cuanto hay los dos puntos; la que cuenta para el precio la calcula el API. */
  private async calcularTrayecto(): Promise<void> {
    const { origen, destino } = this.borrador();
    if (!origen?.placeId || !destino?.placeId) {
      this.trayecto.set(null);
      return;
    }
    try {
      this.trayecto.set(await this.geo.trayecto(origen.placeId, destino.placeId));
    } catch {
      this.trayecto.set(null);
    }
  }
}
