import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

/** Barra del histograma de precios ya normalizada para pintar (PDF 27/07 §3, WA0009). */
export interface BarraHistograma {
  readonly desde: number;
  readonly hasta: number;
  readonly n: number;
}

export interface RangoSeleccionado {
  readonly min: number;
  readonly max: number;
}

/**
 * Slider de rango con doble asa al estilo del filtro "Tu presupuesto (por
 * noche)" de Booking (PDF 27/07 §3, captura WA0009): etiqueta "X € – Y €+",
 * histograma opcional de distribución encima y dos asas sobre un mismo raíl.
 *
 * Son dos `input[type=range]` nativos superpuestos (accesibles con teclado):
 * el CSS deja pasar los eventos solo en las asas. `cambio` se emite al soltar
 * (`change`), no en cada pixel, para no bombardear al API con búsquedas.
 */
@Component({
  selector: 'rs-range-slider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rrs">
      <p class="rrs__etiqueta" aria-live="polite">
        {{ valorMin() }}{{ sufijo() }} – {{ valorMax() }}{{ sufijo() }}{{ valorMax() >= max() ? '+' : '' }}
      </p>

      @if (histograma().length > 0) {
        <div class="rrs__histograma" aria-hidden="true">
          @for (barra of barrasVista(); track barra.desde) {
            <span class="rrs__barra"
                  [class.rrs__barra--activa]="barra.enRango"
                  [style.height.%]="barra.altura"></span>
          }
        </div>
      }

      <div class="rrs__rail">
        <span class="rrs__relleno"
              [style.left.%]="pctMin()"
              [style.width.%]="pctMax() - pctMin()"></span>
        <input type="range" class="rrs__asa"
               [min]="min()" [max]="max()" [step]="step()"
               [value]="valorMin()"
               aria-label="Precio mínimo"
               (input)="moverMin($event)"
               (change)="emitir()" />
        <input type="range" class="rrs__asa"
               [min]="min()" [max]="max()" [step]="step()"
               [value]="valorMax()"
               aria-label="Precio máximo"
               (input)="moverMax($event)"
               (change)="emitir()" />
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .rrs__etiqueta {
      margin: 0 0 var(--sp-2);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      color: var(--t-200);
    }

    /* Histograma de distribución sobre el raíl, como en Booking (WA0009). */
    .rrs__histograma {
      display: flex;
      align-items: flex-end;
      gap: 1px;
      height: 36px;
      margin-bottom: 2px;
    }

    .rrs__barra {
      flex: 1 1 0;
      min-height: 2px;
      border-radius: 1px 1px 0 0;
      background: var(--b-2);
      transition: background var(--d-2);
    }

    .rrs__barra--activa { background: var(--c-accent-lo); }

    .rrs__rail {
      position: relative;
      height: 20px;

      /* Raíl base */
      &::before {
        content: '';
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        left: 0; right: 0;
        height: 4px;
        border-radius: var(--r-full);
        background: var(--b-2);
      }
    }

    .rrs__relleno {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      height: 4px;
      border-radius: var(--r-full);
      background: var(--c-accent);
    }

    /* Dos ranges superpuestos: solo las asas reciben el puntero. */
    .rrs__asa {
      position: absolute;
      inset: 0;
      width: 100%;
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      background: none;
      pointer-events: none;

      &::-webkit-slider-thumb {
        appearance: none;
        -webkit-appearance: none;
        pointer-events: auto;
        width: 18px;
        height: 18px;
        border-radius: var(--r-full);
        background: var(--c-card);
        border: 2.5px solid var(--c-accent);
        box-shadow: var(--sh-sm);
        cursor: grab;
      }

      &::-moz-range-thumb {
        pointer-events: auto;
        width: 18px;
        height: 18px;
        border-radius: var(--r-full);
        background: var(--c-card);
        border: 2.5px solid var(--c-accent);
        box-shadow: var(--sh-sm);
        cursor: grab;
      }
    }
  `],
})
export class RsRangeSliderComponent {
  readonly min = input(0);
  readonly max = input(500);
  readonly step = input(5);
  /**
   * Unidad que acompaña a los dos extremos. Va detrás de la cifra, que es como
   * se escribe el euro en español (feedback 2026-08-20). El espacio es duro
   * —igual que en `EurosPipe`— para que la etiqueta no se parta por ahí.
   */
  readonly sufijo = input(' €');
  /** Distribución de precios para el histograma; vacío = no se pinta. */
  readonly histograma = input<BarraHistograma[]>([]);

  readonly valorMin = model(0);
  readonly valorMax = model(500);

  /** Se emite al soltar el asa, con el rango final. */
  readonly cambio = output<RangoSeleccionado>();

  readonly pctMin = computed(() => this.aPorcentaje(this.valorMin()));
  readonly pctMax = computed(() => this.aPorcentaje(this.valorMax()));

  /** Barras normalizadas a la más alta, marcando las que caen dentro del rango elegido. */
  readonly barrasVista = computed(() => {
    const barras = this.histograma();
    const maxN = Math.max(1, ...barras.map((b) => b.n));
    return barras.map((b) => ({
      desde: b.desde,
      altura: Math.max(6, Math.round((b.n / maxN) * 100)),
      enRango: b.hasta >= this.valorMin() && b.desde <= this.valorMax(),
    }));
  });

  moverMin(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    // El asa mínima nunca cruza a la máxima.
    this.valorMin.set(Math.min(valor, this.valorMax()));
  }

  moverMax(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    this.valorMax.set(Math.max(valor, this.valorMin()));
  }

  emitir(): void {
    this.cambio.emit({ min: this.valorMin(), max: this.valorMax() });
  }

  private aPorcentaje(valor: number): number {
    const rango = this.max() - this.min();
    if (rango <= 0) return 0;
    return Math.round(((valor - this.min()) / rango) * 100);
  }
}
