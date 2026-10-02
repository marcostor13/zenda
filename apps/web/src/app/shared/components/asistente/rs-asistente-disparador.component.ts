import {
  ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, inject, viewChild,
} from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { AsistenteUiService } from './asistente-ui.service';

/**
 * Botón «¿Te ayudo?» de la cabecera, que abre el asistente.
 *
 * Antes era un flotante abajo a la izquierda y tapaba contenido: la última
 * tarjeta de un listado, el pie de un formulario o la paginación. En la
 * cabecera tiene un sitio propio, se ve en todas las resoluciones y el
 * usuario lo encuentra donde busca la ayuda. En escritorio lleva la pregunta
 * escrita; en móvil se queda en el icono, que la barra no da para más.
 */
@Component({
  selector: 'rs-asistente-disparador',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<button #boton type="button" class="ad" (click)="alternar()"
        data-testid="disparador-asistente"
        [class.ad--abierto]="ui.abierto()"
        [attr.aria-expanded]="ui.abierto()"
        aria-haspopup="dialog"
        [attr.aria-label]="'Abrir el asistente de Doogking' | t"
        [attr.title]="'Abrir el asistente de Doogking' | t">
  <rs-icon name="sparkles" [size]="16" [stroke]="2" />
  <span class="ad__txt">{{ '¿Te ayudo?' | t }}</span>
</button>
  `,
  styles: [`
    :host { display: inline-flex; flex: none; }

    .ad {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      height: 34px; padding-inline: var(--sp-3);
      border: none; border-radius: var(--r-full);
      background: var(--g-accent); color: #fff;
      font: var(--w-6) var(--f-xs) var(--font); white-space: nowrap;
      cursor: pointer;
      transition: transform var(--d-2), box-shadow var(--d-2);
      &:hover { transform: translateY(-1px); box-shadow: var(--sh-lg); }
      &:focus-visible { outline: 3px solid var(--dk-gold); outline-offset: 2px; }
      rs-icon { color: var(--dk-gold-light); flex: none; }
    }
    .ad--abierto { box-shadow: 0 0 0 3px var(--c-accent-lo); }

    /* Móvil y tablet estrecha: un círculo con el icono, del tamaño de la cuenta. */
    @media (max-width: 768px) {
      .ad { position: relative; width: 40px; height: 40px; padding: 0; justify-content: center; }
      .ad rs-icon { transform: scale(1.15); }
      .ad__txt {
        position: absolute; width: 1px; height: 1px; overflow: hidden;
        clip: rect(0 0 0 0); white-space: nowrap;
      }
    }
    @media (prefers-reduced-motion: reduce) { .ad { transition: none; } }
  `],
})
export class RsAsistenteDisparadorComponent implements OnInit, OnDestroy {
  protected readonly ui = inject(AsistenteUiService);
  private readonly boton = viewChild.required<ElementRef<HTMLButtonElement>>('boton');

  ngOnInit(): void { this.ui.registrarDisparador(); }
  ngOnDestroy(): void { this.ui.retirarDisparador(); }

  protected alternar(): void {
    this.ui.alternar(this.boton().nativeElement);
  }
}
