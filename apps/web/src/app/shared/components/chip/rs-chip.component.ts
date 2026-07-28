import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Chip de filtro redondeado (HU-0.5). Estado activo = fondo dorado + texto
 * negro, distinto de `.rs-vtab` (que usa el azul de marca para tabs de
 * categoría). Úsalo para filtros de listados, chips de Explora, etc.
 */
@Component({
  selector: 'rs-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="rs-chip"
      [class.rs-chip--active]="active()"
      [class.rs-chip--all]="isAll()"
      [attr.aria-pressed]="active()"
      (click)="chipClick.emit()">
      <ng-content />
    </button>
  `,
})
export class RsChipComponent {
  readonly active = input(false);
  /** Distingue visualmente el chip "Todos" del resto (HU-0.5). */
  readonly isAll = input(false);
  readonly chipClick = output<void>();
}
