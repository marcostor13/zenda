import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EurosPipe } from '../../pipes/euros.pipe';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/**
 * Barra de la acción principal de un paso: fija abajo en móvil (con el precio
 * a la vista si lo hay) y en línea al final del contenido en escritorio.
 *
 * Unifica el `.mobile-cta` de la ficha y el `.wizard-nav` del asistente, que
 * resolvían lo mismo con dos alturas y dos sombras distintas. Deja el hueco
 * del safe-area del iPhone y de la barra de navegación inferior de la app.
 *
 * El botón (o los botones) van proyectados: la barra no decide qué hace.
 */
@Component({
  selector: 'rs-barra-cta',
  standalone: true,
  imports: [EurosPipe, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="bc">
  @if (precio() !== null) {
    <div class="bc__precio">
      <span class="bc__etiqueta">{{ etiquetaPrecio() | t }}</span>
      <strong class="bc__importe">{{ precio() | euros }}</strong>
    </div>
  }
  <div class="bc__acciones"><ng-content /></div>
</div>
  `,
  styles: [`
    :host { display: block; margin-top: var(--sp-6); }
    .bc { display: flex; align-items: center; justify-content: flex-end; gap: var(--sp-4); }
    .bc__precio { display: flex; flex-direction: column; margin-right: auto; }
    .bc__etiqueta { font-size: var(--f-xs); color: var(--t-400); }
    .bc__importe { font-family: var(--font-display); font-size: var(--f-xl); font-weight: var(--w-8); color: var(--dk-blue-text); }
    .bc__acciones { display: flex; gap: var(--sp-2); flex-wrap: wrap; justify-content: flex-end; }

    @media (max-width: 768px) {
      /* Hueco para que el contenido no quede debajo de la barra fija. */
      :host { height: 84px; margin-top: var(--sp-4); }
      .bc {
        position: fixed; z-index: var(--z-3); left: 0; right: 0;
        /* En la app, encima de la barra de navegación (que ya cuenta el safe-area). */
        bottom: var(--dk-nav-inferior-h, 0px);
        padding: var(--sp-3) var(--sp-4) calc(var(--sp-3) + env(safe-area-inset-bottom, 0px));
        background: var(--c-card); border-top: 1px solid var(--b-2);
        box-shadow: 0 -8px 24px rgba(0, 19, 93, .08);
      }
      :host-context(.dk-nativo) .bc { padding-bottom: var(--sp-3); }
      .bc__acciones { flex: 1 1 auto; }
      .bc__acciones ::ng-deep .rs-btn { flex: 1 1 auto; }
    }
  `],
})
export class RsBarraCtaComponent {
  /** `null` = sin precio: la barra sólo lleva la acción. */
  readonly precio = input<number | null>(null);
  readonly etiquetaPrecio = input('Total');
}
