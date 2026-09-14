import {
  ChangeDetectionStrategy, Component, computed, effect, forwardRef, inject, input, signal, untracked,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import type { AgendaCitasRespuestaApi, DiaAgendaApi, DiaCalendarioApi } from 'shared';
import {
  RsCalendarioRangoComponent, type MesVisible, type RangoFechas,
} from '../../../shared/components/calendario-rango/rs-calendario-rango.component';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { ReservasService } from '../services/reservas.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

const DIAS_SEMANA_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'listo'; respuesta: AgendaCitasRespuestaApi };

/** `Date` → `YYYY-MM-DD`. Todo el calendario razona por día, no por instante. */
const clave = (fecha: Date): string => fecha.toISOString().slice(0, 10);

/** Último día del mes, `YYYY-MM-DD`. `mes` es 1-12. */
const finDeMes = (anio: number, mes: number): string =>
  clave(new Date(Date.UTC(anio, mes, 0)));

/**
 * Día de la cita, elegido sobre un calendario que ya sabe qué días hay.
 *
 * Sustituye al `input type="date"` con el que el cliente escribía una fecha a
 * ciegas y sólo después —al cargar las horas— descubría que el comercio cerraba
 * ese día o que estaba lleno. Aquí los días cerrados y los llenos llegan
 * apagados, el primero libre viene ya elegido y el atajo de arriba lleva a la
 * primera cita que existe. No queda nada que adivinar.
 *
 * Es un control de formulario: su valor es el día `YYYY-MM-DD`, igual que el
 * campo al que sustituye. Si el servicio no se reserva por citas o la consulta
 * falla, vuelve al campo de fecha de siempre para no bloquear la reserva.
 */
@Component({
  selector: 'dk-selector-dia',
  standalone: true,
  imports: [TraducirPipe, RsIconComponent, RsCalendarioRangoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectorDiaComponent), multi: true }],
  template: `
    @switch (estado().tipo) {
      @case ('cargando') {
        <div class="dia-cargando" role="status" aria-live="polite">
          <span class="rs-spinner"></span> {{ 'Buscando días con cita libre…' | t }}
        </div>
      }
      @case ('error') {
        <input type="date" class="rs-inp rs-inp--lg" [value]="valor()" [min]="hoy"
               (input)="escribir($event)" (blur)="tocado()"
               data-testid="fecha-manual" [attr.aria-label]="'Fecha de la cita' | t" />
        <span class="rs-field-hint">{{ 'No hemos podido cargar el calendario. Elige tú la fecha.' | t }}</span>
      }
      @case ('listo') {
        @if (respuesta(); as r) {
          @if (!r.soportado) {
            <input type="date" class="rs-inp rs-inp--lg" [value]="valor()" [min]="hoy"
                   (input)="escribir($event)" (blur)="tocado()"
                   data-testid="fecha-manual" [attr.aria-label]="'Fecha de la cita' | t" />
          } @else if (r.motivo && !r.dias.length) {
            <p class="dia-aviso dia-aviso--cerrado" data-testid="agenda-sin-citas">{{ r.motivo | t }}</p>
          } @else {
            @if (primeraLibre(); as primera) {
              <!-- El atajo va arriba: es la respuesta a «¿cuándo puedo?», que es
                   lo primero que se pregunta quien entra a pedir cita. -->
              <button type="button" class="dia-atajo" data-testid="atajo-primera-cita"
                      [class.dia-atajo--elegida]="primera.fecha === valor()"
                      [disabled]="deshabilitado()" (click)="elegirDia(primera.fecha)">
                <rs-icon name="calendar" [size]="16" [stroke]="2" />
                <span>
                  {{ 'Primera cita libre' | t }}:
                  <strong>{{ diaLegible(primera.fecha) }} · {{ primera.hora }}</strong>
                </span>
              </button>
            }

            <rs-calendario-rango
              [dias]="diasCalendario()" [soloUnDia]="true" [entrada]="valor() || null"
              [cargando]="cargandoMes()"
              (rangoElegido)="alElegir($event)" (mesCambiado)="alCambiarMes($event)" />

            @if (diaElegido(); as dia) {
              <p class="dia-resumen" data-testid="resumen-dia">
                <strong>{{ diaLegible(dia.fecha) }}</strong>
                @if (dia.estado === 'libre') {
                  · {{ dia.huecosLibres === 1
                        ? ('1 cita libre' | t)
                        : ('{n} citas libres' | t: { n: dia.huecosLibres }) }}
                } @else {
                  · {{ (dia.motivo || 'Sin citas libres este día.') | t }}
                }
              </p>
            } @else if (!sinDiasLibres()) {
              <p class="dia-resumen">{{ 'Elige un día con cita libre.' | t }}</p>
            }

            @if (sinDiasLibres()) {
              <p class="dia-aviso dia-aviso--cerrado" data-testid="mes-sin-citas">
                {{ 'No quedan citas en este mes. Prueba con el siguiente.' | t }}
              </p>
            }
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }

    .dia-atajo {
      display: flex; align-items: center; gap: var(--s-2);
      width: 100%; margin-bottom: var(--s-3);
      padding: var(--s-3); border: 1px solid var(--dk-gold); border-radius: var(--r-lg);
      background: rgba(251,174,23,.10); color: var(--dk-blue-text);
      font: var(--fw-normal) var(--text-sm) var(--font); text-align: left; cursor: pointer;
      transition: background var(--t-fast), border-color var(--t-fast);
    }
    .dia-atajo:hover:not(:disabled) { background: rgba(251,174,23,.20); }
    .dia-atajo:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    .dia-atajo:disabled { cursor: not-allowed; opacity: .6; }
    .dia-atajo rs-icon { color: var(--dk-gold); flex: none; }
    .dia-atajo--elegida { border-color: var(--dk-blue); background: var(--c-accent-lo); }

    .dia-resumen {
      margin: var(--s-2) 0 0; font-size: var(--text-sm); color: var(--text-secondary);
    }
    .dia-resumen strong { color: var(--dk-blue); text-transform: capitalize; }

    .dia-aviso {
      margin: var(--s-2) 0 0; padding: var(--s-3); border-radius: var(--r-lg);
      background: var(--c-base); color: var(--text-secondary); font-size: var(--text-sm);
    }
    .dia-aviso--cerrado { background: var(--c-accent-lo); color: var(--dk-blue-text); }

    .dia-cargando {
      display: flex; align-items: center; gap: var(--s-2);
      min-height: 2.75rem; color: var(--text-secondary); font-size: var(--text-sm);
    }
  `],
})
export class SelectorDiaComponent implements ControlValueAccessor {
  private readonly reservas = inject(ReservasService);

  readonly servicioId = input<string | null | undefined>();
  /** Servicio concreto (baño, vacunación…): cambia la duración y con ella los huecos. */
  readonly servicio = input<string | null | undefined>();
  readonly perroId = input<string | null | undefined>();
  readonly cantidad = input<number | undefined>();

  readonly hoy = clave(new Date());

  protected readonly valor = signal('');
  protected readonly deshabilitado = signal(false);
  protected readonly estado = signal<Estado>({ tipo: 'cargando' });
  /** Recarga en curso al cambiar de mes: el calendario ya pintado no se vacía. */
  protected readonly cargandoMes = signal(false);

  /** Mes que se está mirando. Arranca en el actual, como el propio calendario. */
  private readonly mes = signal<MesVisible>({
    anio: new Date().getUTCFullYear(),
    mes: new Date().getUTCMonth() + 1,
  });

  /**
   * Agenda ya pedida, por mes y por parámetros de la consulta. Volver al mes
   * anterior es lo más normal del mundo al comparar días, y sin caché cada
   * vaivén era otra consulta.
   */
  private readonly cache = new Map<string, AgendaCitasRespuestaApi>();

  /** Un día ya elegido a mano manda sobre la sugerencia automática. */
  private elegidoPorElCliente = false;

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  constructor() {
    effect(() => {
      // Lo que dispara la recarga se lee aquí, y sólo esto: la carga va en
      // `untracked` porque mira y escribe `estado`, y un efecto que depende de
      // lo que él mismo escribe se vuelve a lanzar sin fin.
      const servicioId = this.servicioId();
      const consulta = {
        servicio: this.servicio(), perroId: this.perroId(), cantidad: this.cantidad(),
      };
      const mes = this.mes();

      untracked(() => {
        if (!servicioId) {
          this.estado.set({ tipo: 'error' });
          return;
        }
        void this.cargar(servicioId, consulta, mes);
      });
    });
  }

  protected readonly respuesta = computed(() => {
    const estado = this.estado();
    return estado.tipo === 'listo' ? estado.respuesta : null;
  });

  /** La agenda traducida al contrato del calendario: cerrado y lleno se pintan igual. */
  protected readonly diasCalendario = computed<DiaCalendarioApi[]>(
    () => (this.respuesta()?.dias ?? []).map((dia) => ({
      fecha: dia.fecha,
      disponible: dia.estado === 'libre',
      plazasLibres: dia.huecosLibres,
    })),
  );

  protected readonly primeraLibre = computed(() => this.respuesta()?.primeraLibre);

  protected readonly diaElegido = computed<DiaAgendaApi | undefined>(
    () => this.respuesta()?.dias.find((dia) => dia.fecha === this.valor()),
  );

  protected readonly sinDiasLibres = computed(() => {
    const dias = this.respuesta()?.dias ?? [];
    // Los días pasados no cuentan: en el mes en curso siempre habrá alguno.
    const futuros = dias.filter((dia) => dia.estado !== 'pasado');
    return futuros.length > 0 && futuros.every((dia) => dia.estado !== 'libre');
  });

  /** "lun 5 oct", que es como se nombra un día al hablar de una cita. */
  protected diaLegible(fecha: string): string {
    const dia = new Date(`${fecha}T12:00:00Z`);
    return `${DIAS_SEMANA_CORTOS[dia.getUTCDay()]} ${dia.getUTCDate()} ${MESES_CORTOS[dia.getUTCMonth()]}`;
  }

  protected alElegir(rango: RangoFechas): void {
    if (rango.entrada) this.elegirDia(rango.entrada);
  }

  protected elegirDia(fecha: string): void {
    this.elegidoPorElCliente = true;
    this.publicar(fecha);
  }

  protected alCambiarMes(mes: MesVisible): void {
    this.mes.set(mes);
  }

  protected escribir(evento: Event): void {
    this.elegidoPorElCliente = true;
    this.publicar((evento.target as HTMLInputElement).value);
  }

  protected tocado(): void { this.alTocar(); }

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
    // Un valor que llega de fuera es una elección tan buena como la del cliente.
    if (valor) this.elegidoPorElCliente = true;
  }

  registerOnChange(fn: (valor: string) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocar = fn; }
  setDisabledState(deshabilitado: boolean): void { this.deshabilitado.set(deshabilitado); }

  private publicar(fecha: string): void {
    this.valor.set(fecha);
    this.alCambiar(fecha);
    this.alTocar();
  }

  private async cargar(
    servicioId: string,
    consulta: { servicio?: string | null; perroId?: string | null; cantidad?: number },
    mes: MesVisible,
  ): Promise<void> {
    // Del mes en curso sólo interesa lo que queda por delante.
    const primero = clave(new Date(Date.UTC(mes.anio, mes.mes - 1, 1)));
    const desde = primero < this.hoy ? this.hoy : primero;
    const hasta = finDeMes(mes.anio, mes.mes);
    if (hasta < desde) {
      this.estado.set({ tipo: 'listo', respuesta: { soportado: true, dias: [] } });
      return;
    }

    const llave = [servicioId, consulta.servicio, consulta.perroId, consulta.cantidad, desde, hasta].join('|');
    const guardada = this.cache.get(llave);
    if (guardada) {
      this.aplicar(guardada);
      return;
    }

    // Al cambiar de mes se marca aparte: vaciar el calendario en cada salto
    // hacía parpadear la rejilla entera por un dato que llega en un instante.
    const primeraCarga = this.estado().tipo !== 'listo';
    if (primeraCarga) this.estado.set({ tipo: 'cargando' });
    this.cargandoMes.set(true);

    try {
      const respuesta = await this.reservas.agenda({ servicioId, desde, hasta, ...consulta });
      this.cache.set(llave, respuesta);
      this.aplicar(respuesta);
    } catch {
      this.estado.set({ tipo: 'error' });
    } finally {
      this.cargandoMes.set(false);
    }
  }

  /**
   * Además de guardar la respuesta, adelanta el primer día libre.
   *
   * Es lo que quita la pantalla en blanco: al abrir el paso ya hay un día
   * elegido y sus horas cargadas, en vez de un calendario esperando a que el
   * cliente acierte. Sólo mientras no haya elegido él: su elección manda.
   */
  private aplicar(respuesta: AgendaCitasRespuestaApi): void {
    this.estado.set({ tipo: 'listo', respuesta });

    if (this.elegidoPorElCliente || !respuesta.soportado) return;
    if (respuesta.primeraLibre) this.publicar(respuesta.primeraLibre.fecha);
  }
}
