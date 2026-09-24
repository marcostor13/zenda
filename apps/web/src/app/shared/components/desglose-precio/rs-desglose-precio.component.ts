import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IVA_RATE } from 'shared';
import { EurosPipe } from '../../pipes/euros.pipe';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

export interface LineaPrecio {
  readonly concepto: string;
  readonly importe: number;
}

/**
 * Desglose de un precio cerrado: conceptos, total destacado y el IVA que va
 * dentro (los precios se anuncian con IVA incluido, CLAUDE.md §9: la base se
 * saca dividiendo, nunca se suma encima).
 *
 * Los conceptos llegan del API ya pensados para el cliente («Trayecto»,
 * «Suplemento urgente»); aquí no se inventa ninguno.
 */
@Component({
  selector: 'rs-desglose-precio',
  standalone: true,
  imports: [EurosPipe, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="dp">
  <dl class="dp__lineas">
    @for (l of lineas(); track $index) {
      <div class="dp__linea">
        <dt>{{ l.concepto | t }}</dt>
        <dd>{{ l.importe | euros }}</dd>
      </div>
    }
  </dl>
  @if (viajes() > 1) {
    <p class="dp__serie">{{ '{n} viajes × {precio}' | t: { n: viajes(), precio: (precioPorViaje() | euros) } }}</p>
  }
  <div class="dp__total">
    <span>{{ 'Total' | t }}</span>
    <strong>{{ total() | euros }}</strong>
  </div>
  <p class="dp__iva">{{ 'IVA incluido ({iva})' | t: { iva: (iva() | euros) } }}</p>
</div>
  `,
  styles: [`
    :host { display: block; }
    .dp__lineas { display: flex; flex-direction: column; gap: var(--sp-2); margin: 0; }
    .dp__linea { display: flex; justify-content: space-between; gap: var(--sp-3); font-size: var(--f-sm); color: var(--t-300); }
    .dp__linea dd { margin: 0; color: var(--t-200); font-variant-numeric: tabular-nums; }
    .dp__serie { margin: var(--sp-2) 0 0; font-size: var(--f-xs); color: var(--t-400); }
    .dp__total {
      display: flex; justify-content: space-between; align-items: baseline;
      margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--b-2);
      font-weight: var(--w-7); color: var(--t-100);
    }
    .dp__total strong { font-family: var(--font-display); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--dk-blue-text); }
    .dp__iva { margin: var(--sp-1) 0 0; text-align: right; font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class RsDesglosePrecioComponent {
  /** Líneas de **un** viaje. */
  readonly lineas = input.required<readonly LineaPrecio[]>();
  /** Viajes que cubre el pago (una serie recurrente se paga entera). */
  readonly viajes = input(1);

  readonly precioPorViaje = computed(() => this.lineas().reduce((suma, l) => suma + l.importe, 0));
  readonly total = computed(() => Math.round(this.precioPorViaje() * this.viajes() * 100) / 100);
  readonly iva = computed(() => Math.round((this.total() - this.total() / (1 + IVA_RATE)) * 100) / 100);
}
