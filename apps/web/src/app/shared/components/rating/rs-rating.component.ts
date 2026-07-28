import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Recuadro de valoración estilo Booking: nota + etiqueta cualitativa + nº de
 * reseñas. Extrae el patrón `.rs-rating` que antes se duplicaba como HTML
 * crudo en alojamiento-detalle y vertical-browse (HU-0.8).
 */
@Component({
  selector: 'rs-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rs-rating" [class.rs-rating--sm]="size() === 'sm'">
      <div class="rs-rating__score">{{ score() }}</div>
      <div>
        @if (label()) { <div class="rs-rating__label">{{ label() }}</div> }
        @if (count() !== null) {
          <div class="rs-rating__count">{{ count() | number }} reseñas</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .rs-rating--sm .rs-rating__score { min-width: 28px; height: 28px; font-size: var(--f-xs); }
  `],
})
export class RsRatingComponent {
  readonly score = input.required<number | string>();
  readonly label = input<string>('');
  readonly count = input<number | null>(null);
  readonly size = input<'md' | 'sm'>('md');
}
