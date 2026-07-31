import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';

export interface TrustItem {
  /** Nombre de icono de `rs-icon` (Lucide). Nunca un emoji: TCK-8009 / TCK-8010. */
  icon: string;
  label: string;
}

/**
 * Orden fijado por el cliente en TCK-8009: primero lo que genera confianza
 * (verificación, pago seguro, inmediatez, reseñas) y sólo después las
 * condiciones económicas y de cancelación.
 */
const ITEMS_RESERVA: readonly TrustItem[] = [
  { icon: 'badge-check', label: 'Empresa verificada' },
  { icon: 'lock', label: 'Pago seguro con Stripe' },
  { icon: 'zap', label: 'Confirmación inmediata' },
  { icon: 'star', label: 'Reseñas verificadas' },
  { icon: 'credit-card', label: 'Sin cargos ocultos' },
  { icon: 'calendar', label: 'Cancelación según política' },
  { icon: 'headphones', label: 'Atención al cliente' },
  { icon: 'handshake', label: 'Soporte antes, durante y después de la estancia' },
];

const ITEMS_PROTECCION: readonly TrustItem[] = [
  {
    icon: 'shield-check',
    label:
      'Protección Doogking: tu dinero está protegido hasta que el servicio se complete según la política de cancelación',
  },
];

/**
 * Bloque de confianza reutilizable (HU-0.7). Generaliza `.booking-panel__trust`
 * (antes texto libre repetido por ficha) en un componente con checks
 * configurables; añade `items` extra propios de cada vertical/pantalla.
 */
@Component({
  selector: 'rs-trust-block',
  standalone: true,
  imports: [RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="rs-trust-block">
      @for (item of itemsFinales(); track item.label) {
        <li class="rs-trust-block__item">
          <rs-icon class="rs-trust-block__icon" [name]="item.icon" [size]="16" [stroke]="2" />
          <span>{{ item.label }}</span>
        </li>
      }
    </ul>
    <ng-content />
  `,
  styles: [`
    :host { display: block; }

    .rs-trust-block {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }

    .rs-trust-block__item {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-2);
      font-size: var(--f-xs);
      line-height: 1.45;
      color: var(--t-400);
    }

    /* El icono no debe encogerse cuando la etiqueta ocupa dos líneas. */
    .rs-trust-block__icon {
      flex: 0 0 auto;
      margin-top: 1px;
      color: var(--c-accent);
    }
  `],
})
export class RsTrustBlockComponent {
  readonly variant = input<'reserva' | 'proteccion'>('reserva');
  readonly items = input<TrustItem[]>([]);

  readonly itemsFinales = computed<TrustItem[]>(() => {
    const base = this.variant() === 'proteccion' ? ITEMS_PROTECCION : ITEMS_RESERVA;
    return [...base, ...this.items()];
  });
}
