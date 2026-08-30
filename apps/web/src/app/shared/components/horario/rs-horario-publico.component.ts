import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ExcepcionHorarioDto, HorarioDiaDto } from 'shared';
import { RsIconComponent } from '../icon/rs-icon.component';
import { desdeClaveDia, hoyLocal } from '../../fechas';

const ETIQUETAS: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
  viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

/** Índice de `Date.getDay()` (0 = domingo) a la clave del día. */
const POR_INDICE = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/**
 * "Cuándo atienden" de la ficha pública: la semana del servicio y los días
 * especiales que quedan por delante.
 *
 * Lee el horario del **servicio**, no del comercio: es el dato que el cliente
 * necesita para saber si puede ir, y el mismo negocio puede tener la peluquería
 * abriendo de tarde y la residencia sólo por la mañana.
 */
@Component({
  selector: 'rs-horario-publico',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RsIconComponent],
  template: `
    @if (hayHorario()) {
      <div class="hp">
        <h2 class="hp__tit">Cuándo atienden</h2>

        <ul class="hp__semana">
          @for (d of semana(); track d.dia) {
            <li class="hp__dia" [class.hp__dia--hoy]="d.esHoy" [class.hp__dia--cerrado]="d.cerrado">
              <span class="hp__nombre">{{ d.label }}</span>
              <span class="hp__horas">{{ d.horas }}</span>
            </li>
          }
        </ul>

        @if (especialesProximos().length) {
          <div class="hp__esp">
            <p class="hp__esp-tit">
              <rs-icon name="alert-circle" [size]="14" [stroke]="2" />
              Días especiales
            </p>
            <ul>
              @for (e of especialesProximos(); track e.fecha) {
                <li>
                  <strong>{{ e.fechaLegible }}</strong>
                  · {{ e.horas }}@if (e.motivo) { · {{ e.motivo }} }
                </li>
              }
            </ul>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .hp { display: flex; flex-direction: column; gap: var(--sp-3); }
    .hp__tit { font-size: var(--f-lg); font-weight: var(--w-7); color: var(--t-100); }

    .hp__semana { display: flex; flex-direction: column; }
    .hp__dia {
      display: flex; justify-content: space-between; gap: var(--sp-4);
      padding: var(--sp-2) 0; font-size: var(--f-sm);
      border-bottom: 1px solid var(--b-1);
      &:last-child { border: none; }
    }
    .hp__nombre { color: var(--t-300); }
    .hp__horas { color: var(--t-100); font-weight: var(--w-6); text-align: right; }
    .hp__dia--cerrado .hp__horas { color: var(--t-400); font-weight: var(--w-4); }
    /* El día de hoy es el que se busca al abrir la ficha. */
    .hp__dia--hoy .hp__nombre, .hp__dia--hoy .hp__horas { color: var(--dk-blue); font-weight: var(--w-7); }

    .hp__esp {
      padding: var(--sp-3) var(--sp-4); border-radius: var(--r-lg);
      background: var(--c-raised); font-size: var(--f-sm); color: var(--t-300);
    }
    .hp__esp-tit {
      display: flex; align-items: center; gap: var(--sp-2);
      font-weight: var(--w-7); color: var(--t-100); margin-bottom: var(--sp-2);
    }
    .hp__esp-tit rs-icon { color: var(--c-amber); }
    .hp__esp li { line-height: 1.7; }
  `],
})
export class RsHorarioPublicoComponent {
  readonly horario = input<HorarioDiaDto[] | undefined>();
  readonly excepciones = input<ExcepcionHorarioDto[] | undefined>();

  /** Sin ningún día con horas puestas no se pinta nada: una tabla vacía estorba. */
  readonly hayHorario = computed(() =>
    (this.horario() ?? []).some((d) => d.cerrado || (d.abre && d.cierra)));

  readonly semana = computed(() => {
    const hoy = POR_INDICE[hoyLocal().getDay()];
    return (this.horario() ?? []).map((d) => ({
      dia: d.dia,
      label: ETIQUETAS[d.dia] ?? d.dia,
      esHoy: d.dia === hoy,
      cerrado: d.cerrado,
      horas: this.horasDe(d),
    }));
  });

  /**
   * Sólo los días especiales que quedan por delante. Un festivo del año pasado
   * no cambia la decisión de nadie y alarga una lista que se lee de un vistazo.
   */
  readonly especialesProximos = computed(() => {
    const hoy = hoyLocal().getTime();
    return (this.excepciones() ?? [])
      .filter((e) => desdeClaveDia(e.fecha).getTime() >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 6)
      .map((e) => ({
        fecha: e.fecha,
        fechaLegible: desdeClaveDia(e.fecha)
          .toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
        motivo: e.motivo,
        horas: e.cerrado ? 'Cerrado' : `${e.abre ?? '—'} – ${e.cierra ?? '—'}`,
      }));
  });

  private horasDe(d: { cerrado: boolean; abre?: string; cierra?: string; abre2?: string; cierra2?: string }): string {
    if (d.cerrado) return 'Cerrado';

    const tramos = [
      d.abre && d.cierra ? `${d.abre} – ${d.cierra}` : null,
      d.abre2 && d.cierra2 ? `${d.abre2} – ${d.cierra2}` : null,
    ].filter(Boolean);

    return tramos.length ? tramos.join(' · ') : 'Consultar';
  }
}
