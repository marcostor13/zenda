import { ChangeDetectionStrategy, Component, computed, effect, forwardRef, inject, input, signal } from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import type { HuecoCitaApi, HuecosDelDiaRespuestaApi } from 'shared';
import { ReservasService } from '../services/reservas.service';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/** Hasta esta hora (exclusiva) una cita es "de mañana". */
const HORA_TARDE = '14:00';

type Estado =
  | { tipo: 'sin_fecha' }
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'listo'; respuesta: HuecosDelDiaRespuestaApi };

/**
 * Citas libres de un día para elegir con un toque, en lugar de escribir una
 * hora sin saber cuáles quedan. Es un control de formulario: su valor es la
 * hora `HH:mm`, igual que el `<input type="time">` al que sustituye.
 *
 * Si el servicio no se reserva por citas o la consulta falla, vuelve al campo
 * de hora de siempre para no bloquear la reserva.
 */
@Component({
  selector: 'dk-selector-citas',
  standalone: true,
  imports: [TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectorCitasComponent), multi: true }],
  template: `
    @switch (estado().tipo) {
      @case ('sin_fecha') {
        <p class="citas-aviso">{{ 'Elige primero el día para ver las citas libres.' | t }}</p>
      }
      @case ('cargando') {
        <div class="citas-cargando" role="status" aria-live="polite">
          <span class="rs-spinner"></span> {{ 'Buscando citas libres…' | t }}
        </div>
      }
      @case ('error') {
        <input type="time" class="rs-inp rs-inp--lg" [value]="valor()" (input)="escribir($event)" (blur)="tocado()"
               data-testid="hora-manual" [attr.aria-label]="'Hora de la cita' | t" />
        <span class="rs-field-hint">{{ 'No hemos podido cargar las citas. Escribe la hora que prefieras.' | t }}</span>
      }
      @case ('listo') {
        @if (respuesta(); as r) {
          @if (!r.soportado) {
            <input type="time" class="rs-inp rs-inp--lg" [value]="valor()" (input)="escribir($event)" (blur)="tocado()"
                   data-testid="hora-manual" [attr.aria-label]="'Hora de la cita' | t" />
          } @else if (r.estado === 'cerrado') {
            <p class="citas-aviso citas-aviso--cerrado" data-testid="citas-cerrado">
              {{ (r.motivo || 'No hay citas este día.') | t }} {{ 'Prueba con otro día.' | t }}
            </p>
          } @else if (!libres()) {
            <p class="citas-aviso citas-aviso--cerrado" data-testid="citas-completo">
              {{ 'No quedan citas libres este día. Prueba con otro día.' | t }}
            </p>
          } @else {
            <div class="citas" role="radiogroup" [attr.aria-label]="'Citas disponibles' | t">
              @for (grupo of grupos(); track grupo.nombre) {
                <div class="citas-grupo">
                  <span class="citas-grupo__titulo">{{ grupo.nombre | t }}</span>
                  <div class="citas-lista">
                    @for (h of grupo.huecos; track h.hora) {
                      <button type="button" role="radio" class="cita"
                              [class.cita--elegida]="h.hora === valor()"
                              [attr.aria-checked]="h.hora === valor()"
                              [disabled]="!h.disponible || deshabilitado()"
                              [attr.title]="h.disponible ? null : ('Ocupada' | t)"
                              (click)="elegir(h)">{{ h.hora }}</button>
                    }
                  </div>
                </div>
              }
            </div>
            <span class="rs-field-hint">
              @if (r.duracionMin) {
                <span>{{ 'Citas de {minutos} min.' | t: { minutos: r.duracionMin } }}</span>
              }
              @if (r.estado === 'sin_horario') {
                <span>{{ 'Horario orientativo: el comercio aún no ha publicado el suyo.' | t }}</span>
              }
            </span>
          }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .citas { display: flex; flex-direction: column; gap: var(--s-3); }
    .citas-grupo__titulo {
      display: block; margin-bottom: var(--s-2);
      font-family: var(--font-accent); font-size: var(--text-xs); font-weight: var(--fw-bold);
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted);
    }
    .citas-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr)); gap: var(--s-2); }
    .cita {
      padding: var(--s-2) var(--s-1); border: 1px solid var(--dk-divider); border-radius: var(--r-full);
      background: var(--c-card); color: var(--dk-blue); font: var(--fw-semibold) var(--text-sm) var(--font);
      cursor: pointer; transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
    }
    .cita:hover:not(:disabled) { border-color: var(--dk-blue); background: var(--c-accent-lo); }
    .cita:focus-visible { outline: 2px solid var(--dk-gold); outline-offset: 2px; }
    .cita--elegida, .cita--elegida:hover:not(:disabled) { background: var(--dk-blue); border-color: var(--dk-blue); color: var(--c-card); }
    .cita:disabled { cursor: not-allowed; color: var(--text-muted); background: var(--c-base); text-decoration: line-through; opacity: 0.7; }
    .citas-aviso { margin: 0; padding: var(--s-3); border-radius: var(--r-lg); background: var(--c-base); color: var(--text-secondary); font-size: var(--text-sm); }
    .citas-aviso--cerrado { background: var(--c-accent-lo); color: var(--dk-blue-text); }
    .citas-cargando { display: flex; align-items: center; gap: var(--s-2); color: var(--text-secondary); font-size: var(--text-sm); min-height: 2.75rem; }
  `],
})
export class SelectorCitasComponent implements ControlValueAccessor {
  private readonly reservas = inject(ReservasService);

  readonly servicioId = input<string | null | undefined>();
  /** Día `YYYY-MM-DD`. */
  readonly fecha = input<string | null | undefined>();
  /** Servicio concreto (baño, vacunación…): cambia la duración. */
  readonly servicio = input<string | null | undefined>();
  readonly perroId = input<string | null | undefined>();
  readonly cantidad = input<number | null | undefined>();

  readonly valor = signal('');
  readonly deshabilitado = signal(false);
  readonly estado = signal<Estado>({ tipo: 'sin_fecha' });

  readonly respuesta = computed(() => {
    const e = this.estado();
    return e.tipo === 'listo' ? e.respuesta : null;
  });
  readonly libres = computed(() => (this.respuesta()?.huecos ?? []).filter((h) => h.disponible).length);
  readonly grupos = computed(() => {
    const huecos = this.respuesta()?.huecos ?? [];
    return [
      { nombre: 'Mañana', huecos: huecos.filter((h) => h.hora < HORA_TARDE) },
      { nombre: 'Tarde', huecos: huecos.filter((h) => h.hora >= HORA_TARDE) },
    ].filter((g) => g.huecos.length);
  });

  private alCambiar?: (valor: string) => void;
  private alTocar?: () => void;
  /** Sólo cuenta la última consulta: si el cliente cambia de día rápido, la anterior se descarta. */
  private consulta = 0;

  constructor() {
    effect(() => {
      const servicioId = this.servicioId();
      const fecha = this.fecha();
      const servicio = this.servicio();
      const perroId = this.perroId();
      const cantidad = this.cantidad() ?? undefined;
      if (!servicioId || !fecha) {
        this.estado.set({ tipo: 'sin_fecha' });
        return;
      }
      void this.cargar({ servicioId, fecha, servicio, perroId, cantidad });
    });
  }

  private async cargar(consulta: Parameters<ReservasService['huecosDelDia']>[0]): Promise<void> {
    const numero = ++this.consulta;
    this.estado.set({ tipo: 'cargando' });
    try {
      const respuesta = await this.reservas.huecosDelDia(consulta);
      if (numero !== this.consulta) return;
      this.estado.set({ tipo: 'listo', respuesta });
      this.descartarHoraQueYaNoEsta(respuesta);
    } catch {
      if (numero === this.consulta) this.estado.set({ tipo: 'error' });
    }
  }

  /** Una hora elegida para otro día u otro servicio no puede quedarse puesta si ahora no está libre. */
  private descartarHoraQueYaNoEsta(respuesta: HuecosDelDiaRespuestaApi): void {
    if (!respuesta.soportado || !this.valor()) return;
    const sigue = respuesta.huecos.some((h) => h.hora === this.valor() && h.disponible);
    if (!sigue) this.fijar('');
  }

  elegir(hueco: HuecoCitaApi): void {
    if (!hueco.disponible) return;
    this.fijar(hueco.hora);
    this.alTocar?.();
  }

  escribir(evento: Event): void {
    this.fijar((evento.target as HTMLInputElement).value);
  }

  tocado(): void {
    this.alTocar?.();
  }

  private fijar(hora: string): void {
    this.valor.set(hora);
    this.alCambiar?.(hora);
  }

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }
}
