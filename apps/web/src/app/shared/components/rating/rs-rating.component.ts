import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { tieneValoraciones } from 'shared';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/**
 * Recuadro de valoración estilo Booking: nota + etiqueta cualitativa + nº de
 * reseñas. Extrae el patrón `.rs-rating` que antes se duplicaba como HTML
 * crudo en alojamiento-detalle y vertical-browse (HU-0.8).
 *
 * Sin reseñas no hay nota: se enseña «Nuevo · Sin valoraciones» en vez de un
 * «0 · Correcto» que hacía parecer valorado —y mal— a un servicio recién
 * publicado.
 */
@Component({
  selector: 'rs-rating',
  standalone: true,
  imports: [CommonModule, TraducirPipe],
  template: `
    @if (sinValorar()) {
      <div class="rs-rating rs-rating--nuevo" [class.rs-rating--sm]="size() === 'sm'" data-testid="rating-sin-valorar">
        <div class="rs-rating__score rs-rating__score--nuevo">{{ 'Nuevo' | t }}</div>
        <div><div class="rs-rating__count">{{ 'Sin valoraciones' | t }}</div></div>
      </div>
    } @else {
      <div class="rs-rating" [class.rs-rating--sm]="size() === 'sm'">
        <div class="rs-rating__score">{{ score() }}</div>
        <div>
          @if (label()) { <div class="rs-rating__label">{{ label() | t }}</div> }
          @if (count() !== null) {
            <div class="rs-rating__count">{{ (count() === 1 ? '{n} reseña' : '{n} reseñas') | t: { n: (count() | number) ?? '' } }}</div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    .rs-rating--sm .rs-rating__score { min-width: 28px; height: 28px; font-size: var(--f-xs); }
    .rs-rating__score--nuevo {
      width: auto; min-width: 0; padding-inline: var(--sp-2);
      font-size: var(--f-xs); text-transform: uppercase; letter-spacing: .04em;
    }
  `],
})
export class RsRatingComponent {
  readonly score = input.required<number | string>();
  readonly label = input<string>('');
  readonly count = input<number | null>(null);
  readonly size = input<'md' | 'sm'>('md');

  /** Manda el contador: 0 reseñas es «sin valorar» aunque llegue una nota heredada. */
  readonly sinValorar = computed(() => !tieneValoraciones(Number(this.score()), this.count()));
}
