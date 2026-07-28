import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TrustItem {
  icon: string;
  label: string;
}

const ITEMS_RESERVA: TrustItem[] = [
  { icon: '🔒', label: 'Pago seguro con Stripe' },
  { icon: '✅', label: 'Confirmación inmediata' },
  { icon: '💳', label: 'Sin cargos ocultos' },
  { icon: '📅', label: 'Cancelación según política' },
  { icon: '🎧', label: 'Atención al cliente' },
];

const ITEMS_PROTECCION: TrustItem[] = [
  { icon: '🛡️', label: 'Protección Doogking: tu dinero está protegido hasta que el servicio se complete según la política de cancelación' },
];

/**
 * Bloque de confianza reutilizable (HU-0.7). Generaliza `.booking-panel__trust`
 * (antes texto libre repetido por ficha) en un componente con checks
 * configurables; añade `items` extra propios de cada vertical/pantalla.
 */
@Component({
  selector: 'rs-trust-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rs-trust-block">
      @for (item of itemsFinales(); track item.label) {
        <p>{{ item.icon }} {{ item.label }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [`
    :host { display: block; }
    .rs-trust-block {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);

      p { font-size: var(--f-xs); color: var(--t-400); margin: 0; }
    }
  `],
})
export class RsTrustBlockComponent {
  readonly variant = input<'reserva' | 'proteccion'>('reserva');
  readonly items = input<TrustItem[]>([]);

  itemsFinales(): TrustItem[] {
    const base = this.variant() === 'proteccion' ? ITEMS_PROTECCION : ITEMS_RESERVA;
    return [...base, ...this.items()];
  }
}
