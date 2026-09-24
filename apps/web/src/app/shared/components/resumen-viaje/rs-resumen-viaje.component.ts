import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/**
 * Cabecera compacta del viaje: «Castellón → Valencia · 25/09 · 10:30 · Hachi».
 * Encabeza resultados, ficha y revisión para que el cliente sepa en todo
 * momento qué está comparando, con «Modificar búsqueda» a mano.
 */
@Component({
  selector: 'rs-resumen-viaje',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="rv">
  <div class="rv__ruta">
    <rs-icon name="map-pin" [size]="18" [stroke]="2" class="rv__pin"></rs-icon>
    <span class="rv__lugar">{{ origen() }}</span>
    <rs-icon name="arrow-right" [size]="16" [stroke]="2" class="rv__flecha"></rs-icon>
    <span class="rv__lugar">{{ destino() }}</span>
  </div>
  @if (detalles().length) {
    <p class="rv__detalles">{{ detalles().join(' · ') }}</p>
  }
  @if (modificable()) {
    <button type="button" class="rs-btn rs-btn--outline rs-btn--sm rv__modificar" (click)="modificar.emit()">
      <rs-icon name="pencil" [size]="14" [stroke]="2"></rs-icon> {{ 'Modificar búsqueda' | t }}
    </button>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .rv {
      display: grid; grid-template-columns: 1fr auto; gap: var(--sp-1) var(--sp-3); align-items: center;
      padding: var(--sp-3) var(--sp-4);
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-xl); box-shadow: var(--sh-sm);
    }
    .rv__ruta { display: flex; align-items: center; gap: var(--sp-2); min-width: 0; color: var(--dk-blue-text); }
    .rv__pin { color: var(--dk-gold); flex: 0 0 auto; }
    .rv__flecha { color: var(--t-400); flex: 0 0 auto; }
    .rv__lugar {
      font-family: var(--font-display); font-weight: var(--w-8); font-size: var(--f-md);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .rv__detalles { grid-column: 1; margin: 0; font-size: var(--f-xs); color: var(--t-400); }
    .rv__modificar { grid-row: 1 / span 2; grid-column: 2; }
    @media (max-width: 480px) {
      .rv { grid-template-columns: 1fr; }
      .rv__modificar { grid-row: auto; grid-column: 1; justify-self: start; }
    }
  `],
})
export class RsResumenViajeComponent {
  readonly origen = input.required<string>();
  readonly destino = input.required<string>();
  /** Fecha, hora, mascota… ya formateados. */
  readonly detalles = input<readonly string[]>([]);
  readonly modificable = input(true);
  readonly modificar = output<void>();
}
