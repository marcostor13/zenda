import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { FechaPipe } from '../../pipes/fecha.pipe';

export type EstadoPaso = 'hecho' | 'actual' | 'pendiente';

export interface PasoTimeline {
  readonly clave: string;
  /** En español: es la clave de traducción. */
  readonly etiqueta: string;
  readonly estado: EstadoPaso;
  readonly at?: string | Date;
  readonly nota?: string;
  readonly fotoUrl?: string;
}

/**
 * Estado del viaje paso a paso (diapositiva 10 y pantalla 6 del mockup):
 * hechos en azul con su hora, el actual en dorado, los que faltan en gris.
 * Es una lista ordenada con `aria-current` en el paso en curso.
 */
@Component({
  selector: 'rs-timeline-viaje',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe, FechaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<ol class="tl">
  @for (p of pasos(); track p.clave; let ultimo = $last) {
    <li class="tl__paso" [attr.data-estado]="p.estado" [attr.aria-current]="p.estado === 'actual' ? 'step' : null">
      <span class="tl__marca" aria-hidden="true">
        @if (p.estado === 'hecho') { <rs-icon name="check" [size]="12" [stroke]="3"></rs-icon> }
      </span>
      @if (!ultimo) { <span class="tl__linea" aria-hidden="true"></span> }
      <div class="tl__cuerpo">
        <div class="tl__fila">
          <span class="tl__etiqueta">{{ p.etiqueta | t }}</span>
          @if (p.at) {
            <time class="tl__hora">{{ p.at | date: 'd/MM · HH:mm' }}</time>
          } @else if (p.estado === 'actual') {
            <span class="tl__ahora">{{ 'En curso' | t }}</span>
          }
        </div>
        @if (p.nota) { <p class="tl__nota">{{ p.nota }}</p> }
        @if (p.fotoUrl) {
          <a class="tl__foto" [href]="p.fotoUrl" target="_blank" rel="noopener">
            <img [src]="p.fotoUrl" [alt]="'Foto del momento' | t" loading="lazy" />
          </a>
        }
      </div>
    </li>
  }
</ol>
  `,
  styles: [`
    :host { display: block; }
    .tl { margin: 0; padding: 0; list-style: none; }
    .tl__paso { position: relative; display: flex; gap: var(--sp-3); padding-bottom: var(--sp-4); }
    .tl__marca {
      position: relative; z-index: 1; flex: 0 0 auto;
      display: grid; place-items: center; width: 20px; height: 20px; margin-top: 1px;
      border-radius: var(--r-full); border: 2px solid var(--b-2); background: var(--c-card); color: var(--c-card);
    }
    .tl__linea {
      position: absolute; left: 9px; top: 22px; bottom: 0; width: 2px; background: var(--b-2);
    }
    [data-estado='hecho'] .tl__marca { background: var(--dk-blue); border-color: var(--dk-blue); }
    [data-estado='hecho'] .tl__linea { background: var(--dk-blue); }
    [data-estado='actual'] .tl__marca { border-color: var(--dk-gold); box-shadow: 0 0 0 4px var(--dk-gold-lo); }
    [data-estado='actual'] .tl__marca::after {
      content: ''; width: 8px; height: 8px; border-radius: var(--r-full); background: var(--dk-gold);
    }
    .tl__cuerpo { flex: 1; min-width: 0; }
    .tl__fila { display: flex; justify-content: space-between; gap: var(--sp-3); align-items: baseline; }
    .tl__etiqueta { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
    [data-estado='pendiente'] .tl__etiqueta { color: var(--t-400); font-weight: var(--w-5); }
    .tl__hora { font-size: var(--f-xs); color: var(--t-400); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .tl__ahora { font-size: var(--f-xs); font-weight: var(--w-7); color: var(--dk-gold-text); }
    .tl__nota { margin: var(--sp-1) 0 0; font-size: var(--f-xs); color: var(--t-300); }
    .tl__foto img { margin-top: var(--sp-2); width: 120px; height: 90px; object-fit: cover; border-radius: var(--r-md); }
  `],
})
export class RsTimelineViajeComponent {
  readonly pasos = input.required<readonly PasoTimeline[]>();
}
