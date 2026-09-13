import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { VERTICAL_LABELS, VerticalKey } from 'shared';
import { RsIconComponent } from '../../../shared/components/icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';
import { RegistroServicioApi } from '../expediente.service';
import { RegistroServicioComponent } from './registro-servicio.component';
import { iconoDeVertical as iconoVertical } from '../../../shared/verticales/verticales.config';

interface GrupoAnual {
  readonly ano: number;
  readonly registros: readonly RegistroServicioApi[];
}

/**
 * Línea de tiempo del historial, agrupada por año y filtrable por categoría.
 * El filtro sólo aparece si hay más de una: con una sola, sobra.
 */
@Component({
  selector: 'app-historial-timeline',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe, RegistroServicioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
@if (categorias().length > 1) {
  <div class="tl-filtros" role="group" [attr.aria-label]="'Filtrar por categoría' | t">
    <button type="button" class="tl-filtro" [class.activo]="filtro() === null" (click)="filtro.set(null)">
      {{ 'Todo' | t }} <span>{{ registros().length }}</span>
    </button>
    @for (c of categorias(); track c.vertical) {
      <button type="button" class="tl-filtro" [class.activo]="filtro() === c.vertical" (click)="filtro.set(c.vertical)">
        <rs-icon [name]="c.icono" [size]="14" [stroke]="2"></rs-icon> {{ c.etiqueta | t }} <span>{{ c.total }}</span>
      </button>
    }
  </div>
}

@if (!registros().length) {
  <div class="tl-vacio">
    <rs-icon name="clipboard-list" [size]="36" [stroke]="1.5"></rs-icon>
    <p>{{ vacio() | t }}</p>
  </div>
} @else {
  @for (grupo of grupos(); track grupo.ano) {
    <section class="tl-grupo">
      <h3 class="tl-ano">{{ grupo.ano }}</h3>
      <ol class="tl-lista">
        @for (r of grupo.registros; track r._id) {
          <li>
            <app-registro-servicio [registro]="r" [editable]="editable()" [mostrarComercio]="mostrarComercio()"
                                   (editar)="editar.emit($event)" (eliminar)="eliminar.emit($event)" />
          </li>
        }
      </ol>
    </section>
  }
}
  `,
  styles: [`
    :host { display: block; }
    .tl-filtros { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-5); }
    .tl-filtro {
      display: inline-flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-4);
      border-radius: var(--r-full); border: 1px solid var(--b-2); background: var(--c-card); color: var(--t-300);
      font: inherit; font-size: var(--f-sm); cursor: pointer; transition: all var(--d-2);
      span { font-size: var(--f-xs); background: var(--c-raised); color: var(--t-400); border-radius: var(--r-full); padding: 0 var(--sp-2); }
      &.activo { background: var(--c-accent); border-color: var(--c-accent); color: var(--c-card); span { background: var(--c-card); color: var(--c-accent); } }
    }
    .tl-grupo + .tl-grupo { margin-top: var(--sp-6); }
    .tl-ano { font-family: var(--font-accent); font-size: var(--f-sm); font-weight: var(--w-7); color: var(--dk-gold-text); letter-spacing: .1em; margin: 0 0 var(--sp-3); }
    .tl-lista { list-style: none; margin: 0; padding: 0; position: relative; display: grid; gap: var(--sp-4); }
    /* Hilo vertical que une los iconos de la línea de tiempo. */
    .tl-lista::before { content: ''; position: absolute; left: 19px; top: 8px; bottom: 8px; width: 2px; background: var(--b-1); }
    .tl-vacio {
      display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center;
      padding: var(--sp-12) var(--sp-6); color: var(--t-400); border: 1px dashed var(--b-2); border-radius: var(--r-lg);
      p { margin: 0; max-width: 380px; font-size: var(--f-sm); }
    }
  `],
})
export class HistorialTimelineComponent {
  readonly registros = input.required<readonly RegistroServicioApi[]>();
  readonly editable = input(false);
  readonly mostrarComercio = input(true);
  readonly vacio = input('Todavía no hay registros en el historial.');

  readonly editar = output<RegistroServicioApi>();
  readonly eliminar = output<RegistroServicioApi>();

  readonly filtro = signal<string | null>(null);

  readonly categorias = computed(() => {
    const conteo = new Map<string, number>();
    for (const r of this.registros()) conteo.set(r.vertical, (conteo.get(r.vertical) ?? 0) + 1);
    return [...conteo.entries()].map(([vertical, total]) => ({
      vertical,
      total,
      icono: iconoVertical(vertical),
      etiqueta: VERTICAL_LABELS[vertical as VerticalKey] ?? vertical,
    }));
  });

  readonly grupos = computed<GrupoAnual[]>(() => {
    const filtro = this.filtro();
    const porAno = new Map<number, RegistroServicioApi[]>();
    for (const r of this.registros()) {
      if (filtro && r.vertical !== filtro) continue;
      const ano = new Date(r.fechaServicio ?? r.createdAt ?? Date.now()).getFullYear();
      porAno.set(ano, [...(porAno.get(ano) ?? []), r]);
    }
    return [...porAno.entries()].sort(([a], [b]) => b - a).map(([ano, registros]) => ({ ano, registros }));
  });
}
