import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';

/** Máximo de la escala de valoración de la plataforma. */
const TOTAL_ESTRELLAS = 5;

/**
 * Fila de estrellas de una valoración. Sustituye a los helpers que repetían el
 * carácter de estrella como texto: la iconografía es la misma familia Lucide
 * que el resto de la plataforma (TCK-8009 / TCK-8010).
 */
@Component({
  selector: 'rs-stars',
  standalone: true,
  imports: [RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="rs-stars" [attr.aria-label]="etiqueta()" role="img">
      @for (llena of estrellas(); track $index) {
        <rs-icon name="star" [size]="size()" [stroke]="1.75" [filled]="llena"
                 [class.rs-stars__vacia]="!llena" />
      }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .rs-stars { display: inline-flex; align-items: center; gap: 1px; color: var(--c-amber); }
    .rs-stars__vacia { color: var(--b-2); }
  `],
})
export class RsStarsComponent {
  readonly score = input.required<number>();
  readonly size = input<number>(14);

  readonly estrellas = computed<boolean[]>(() => {
    const llenas = Math.round(Math.min(Math.max(this.score(), 0), TOTAL_ESTRELLAS));
    return Array.from({ length: TOTAL_ESTRELLAS }, (_, i) => i < llenas);
  });

  readonly etiqueta = computed(() => `${this.score()} de ${TOTAL_ESTRELLAS}`);
}
