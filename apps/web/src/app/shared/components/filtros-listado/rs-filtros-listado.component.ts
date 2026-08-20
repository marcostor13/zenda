import {
  ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal,
} from '@angular/core';
import { RsChipComponent } from '../chip/rs-chip.component';
import { RsStarsComponent } from '../stars/rs-stars.component';
import {
  RsRangeSliderComponent, type BarraHistograma,
} from '../range-slider/rs-range-slider.component';
import { filtrosDeVertical, type GrupoFiltro } from '../../verticales/filtros.config';

/** Lo que el panel devuelve al listado, listo para enviarse al API. */
export interface FiltrosSeleccionados {
  precioMin?: number;
  precioMax?: number;
  ratingMin?: number;
  amenities?: string[];
  /** Filtros propios del vertical, por campo. */
  vertical: Record<string, string[] | boolean>;
}

/**
 * Panel lateral de filtros de los listados, común a todos los verticales.
 *
 * Los grupos no están escritos aquí: se leen de `filtros.config.ts` según la
 * categoría, de modo que veterinaria muestre sus especialidades y transporte su
 * tipo de vehículo sin que este componente sepa nada de ninguna de las dos.
 */
@Component({
  selector: 'rs-filtros-listado',
  standalone: true,
  imports: [RsChipComponent, RsStarsComponent, RsRangeSliderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<aside class="rs-filtros">
  <div class="rs-filtros__head">
    <h3>Filtros</h3>
    <button type="button" class="rs-btn rs-btn--ghost rs-btn--xs" (click)="limpiar()">Limpiar</button>
  </div>

  @for (g of grupos(); track g.titulo) {
    <div class="rs-filtros__grupo">
      <h4>{{ g.titulo }}@if (g.unidad) { <span class="rs-filtros__unidad"> ({{ g.unidad }})</span> }</h4>

      @switch (g.tipo) {
        @case ('precio') {
          <rs-range-slider
            [min]="0" [max]="g.maximo ?? 500" [step]="5"
            [histograma]="histograma()"
            [(valorMin)]="precioMin" [(valorMax)]="precioMax"
            (cambio)="emitir()" />
        }

        @case ('valoracion') {
          <div class="rs-filtros__chips">
            @for (v of VALORACIONES; track v) {
              <rs-chip [active]="ratingMin() === v" (chipClick)="alternarRating(v)">
                <rs-stars [score]="v" [size]="12" />
                {{ v === 5 ? '5.0' : v + '.0+' }}
                @if (conteoValoracion(v); as n) { <span class="rs-filtros__n">{{ n }}</span> }
              </rs-chip>
            }
          </div>
        }

        @case ('opciones') {
          <div class="rs-filtros__chips">
            @for (o of g.opciones ?? []; track o.valor) {
              <rs-chip [active]="estaMarcado(g, o.valor)" (chipClick)="alternarOpcion(g, o.valor)">
                {{ o.etiqueta }}
                @if (conteoOpcion(o.valor); as n) { <span class="rs-filtros__n">{{ n }}</span> }
              </rs-chip>
            }
          </div>
        }

        @case ('booleanos') {
          <div class="rs-filtros__chips">
            @for (o of g.opciones ?? []; track o.valor) {
              <rs-chip [active]="booleanos()[o.valor] === true" (chipClick)="alternarBooleano(o.valor)">
                {{ o.etiqueta }}
              </rs-chip>
            }
          </div>
        }
      }
    </div>
  }
</aside>
  `,
  styles: [`
    :host { display: block; }

    .rs-filtros {
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-xl);
      padding: var(--sp-6);
    }

    .rs-filtros__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--sp-4);

      h3 { font-size: var(--f-md); font-weight: var(--w-7); color: var(--dk-blue); }
    }

    .rs-filtros__grupo {
      border-top: 1px solid var(--b-1);
      padding-block: var(--sp-5);

      h4 {
        font-size: var(--f-sm); font-weight: var(--w-6);
        color: var(--t-200); margin-bottom: var(--sp-4);
      }
    }

    .rs-filtros__unidad { font-weight: var(--w-4); color: var(--t-400); }
    .rs-filtros__chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .rs-filtros__n { margin-left: var(--sp-2); font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class RsFiltrosListadoComponent implements OnInit {
  readonly vertical = input.required<string>();
  /** Histograma de precios de las facetas, para el deslizador. */
  readonly histograma = input<BarraHistograma[]>([]);
  /** Contadores por opción ("Parking 514"), si el API los aporta. */
  readonly conteos = input<Array<{ valor: string; n: number }>>([]);
  readonly conteosValoracion = input<Array<{ minimo: number; n: number }>>([]);

  readonly cambio = output<FiltrosSeleccionados>();

  readonly VALORACIONES = [5, 4, 3];

  readonly grupos = computed<readonly GrupoFiltro[]>(() => filtrosDeVertical(this.vertical()));

  /** Tope del deslizador del vertical activo; define cuándo "no hay máximo". */
  private readonly topePrecio = computed(() =>
    this.grupos().find((g) => g.tipo === 'precio')?.maximo ?? 500);

  precioMin = 0;
  precioMax = 500;
  readonly ratingMin = signal(0);
  private readonly opciones = signal<Record<string, string[]>>({});
  readonly booleanos = signal<Record<string, boolean>>({});

  /**
   * El tope depende del vertical (500 en alojamiento, 200 en veterinaria…), así
   * que el máximo inicial debe seguirlo o el listado arrancaría filtrando.
   *
   * Va en `ngOnInit` y no en el constructor a propósito: `vertical` es un input
   * requerido y todavía no tiene valor mientras se construye el componente
   * (NG0950), así que leerlo ahí reventaba el listado entero al abrirlo.
   */
  ngOnInit(): void {
    this.precioMax = this.topePrecio();
  }

  conteoOpcion(valor: string): number | null {
    return this.conteos().find((c) => c.valor === valor)?.n ?? null;
  }

  conteoValoracion(minimo: number): number | null {
    return this.conteosValoracion().find((v) => v.minimo === minimo)?.n ?? null;
  }

  estaMarcado(grupo: GrupoFiltro, valor: string): boolean {
    return (this.opciones()[grupo.campo ?? ''] ?? []).includes(valor);
  }

  alternarRating(valor: number): void {
    this.ratingMin.update((actual) => (actual === valor ? 0 : valor));
    this.emitir();
  }

  alternarOpcion(grupo: GrupoFiltro, valor: string): void {
    const campo = grupo.campo;
    if (!campo) return;
    this.opciones.update((actual) => {
      const marcados = actual[campo] ?? [];
      return {
        ...actual,
        [campo]: marcados.includes(valor)
          ? marcados.filter((v) => v !== valor)
          : [...marcados, valor],
      };
    });
    this.emitir();
  }

  alternarBooleano(campo: string): void {
    this.booleanos.update((actual) => ({ ...actual, [campo]: !actual[campo] }));
    this.emitir();
  }

  /**
   * Quita un filtro concreto desde fuera del panel. Lo usan los chips de
   * "filtros aplicados" del listado: la selección vive aquí, así que el listado
   * no puede deshacerla por su cuenta sin duplicar el estado.
   */
  quitar(tipo: 'precio' | 'rating' | 'opcion' | 'booleano', campo?: string, valor?: string): void {
    if (tipo === 'precio') {
      this.precioMin = 0;
      this.precioMax = this.topePrecio();
    } else if (tipo === 'rating') {
      this.ratingMin.set(0);
    } else if (tipo === 'booleano' && campo) {
      this.booleanos.update((actual) => ({ ...actual, [campo]: false }));
    } else if (tipo === 'opcion' && campo && valor) {
      this.opciones.update((actual) => ({
        ...actual,
        [campo]: (actual[campo] ?? []).filter((v) => v !== valor),
      }));
    }
    this.emitir();
  }

  limpiar(): void {
    this.precioMin = 0;
    this.precioMax = this.topePrecio();
    this.ratingMin.set(0);
    this.opciones.set({});
    this.booleanos.set({});
    this.emitir();
  }

  emitir(): void {
    const { amenities, ...vertical } = this.opciones();

    // Solo viaja lo que el usuario ha tocado: un máximo en el tope o una
    // valoración a cero no son filtros, y enviarlos estrecharía la búsqueda
    // sin que nadie lo haya pedido.
    const activos: Record<string, string[] | boolean> = {};
    for (const [campo, valores] of Object.entries(vertical)) {
      if (valores.length) activos[campo] = valores;
    }
    for (const [campo, activo] of Object.entries(this.booleanos())) {
      if (activo) activos[campo] = true;
    }

    this.cambio.emit({
      precioMin: this.precioMin || undefined,
      precioMax: this.precioMax < this.topePrecio() ? this.precioMax : undefined,
      ratingMin: this.ratingMin() || undefined,
      amenities: amenities?.length ? amenities : undefined,
      vertical: activos,
    });
  }
}
