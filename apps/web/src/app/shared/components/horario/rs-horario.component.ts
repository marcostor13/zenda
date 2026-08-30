import { ChangeDetectionStrategy, Component, computed, model, signal } from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import { celdasDelMes, claveDia, desdeClaveDia, hoyLocal } from '../../fechas';
import { festivosNacionalesProximos } from '../../catalogos/festivos-es';
import type { ExcepcionHorarioDto as ExcepcionHorario, HorarioDiaDto as HorarioDia } from 'shared';

const DIAS: ReadonlyArray<{ clave: string; label: string }> = [
  { clave: 'lunes', label: 'Lunes' },
  { clave: 'martes', label: 'Martes' },
  { clave: 'miercoles', label: 'Miércoles' },
  { clave: 'jueves', label: 'Jueves' },
  { clave: 'viernes', label: 'Viernes' },
  { clave: 'sabado', label: 'Sábado' },
  { clave: 'domingo', label: 'Domingo' },
];

/** Semana entera cerrada; el punto de partida de un servicio recién creado. */
export function semanaVacia(): HorarioDia[] {
  return DIAS.map(({ clave }) => ({ dia: clave, cerrado: false, abre: '', cierra: '', abre2: '', cierra2: '' }));
}

/**
 * Horario de atención: la semana día a día —con jornada partida— y el
 * calendario de festivos, vacaciones y cierres puntuales.
 *
 * Cuelga del **servicio** y no del negocio: una peluquería que abre de tarde y
 * la residencia canina del mismo dueño que sólo admite entradas por la mañana
 * son dos horarios distintos, y con uno solo de empresa la ficha enseñaba al
 * cliente un dato que no era el del servicio que estaba reservando.
 */
@Component({
  selector: 'rs-horario',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RsIconComponent],
  template: `
    <div class="hr">
      <!--
        El atajo va **antes** de la semana, no después: quien rellena el lunes
        lo tiene delante justo cuando acaba de escribir el horario que quiere
        repetir. Al pie sólo lo veía quien ya había tecleado los siete días, que
        es exactamente a quien ya no le sirve.
      -->
      <div class="hr__atajos">
        <button type="button" class="rs-btn rs-btn--outline rs-btn--sm" (click)="copiarLunesATodos()">
          <rs-icon name="copy" [size]="14" [stroke]="2" />
          Copiar el lunes a todos los días
        </button>
        <span class="hr__atajos-pista">Rellena el lunes y aplícalo al resto de la semana.</span>
      </div>

      <div class="hr__semana">
        @for (d of dias; track d.clave; let i = $index) {
          <div class="hr-dia" [class.hr-dia--cerrado]="diaDe(i).cerrado">
            <div class="hr-dia__cab">
              <span class="hr-dia__nombre">{{ d.label }}</span>
              <label class="hr-check">
                <input type="checkbox" [checked]="diaDe(i).cerrado"
                       (change)="alternarCerrado(i)" />
                Cerrado
              </label>
            </div>

            <!--
              Las horas desaparecen al marcar "Cerrado": no significan nada ese
              día, y en el móvil son cuatro campos que estorban justo donde el
              espacio es lo que falta.
            -->
            @if (!diaDe(i).cerrado) {
              <div class="hr-dia__tramos">
                <div class="hr-tramo">
                  <span class="hr-tramo__et">Mañana</span>
                  <input class="rs-inp rs-inp--time" type="time" [value]="diaDe(i).abre ?? ''"
                         (input)="fijarHora(i, 'abre', $event)"
                         [attr.aria-label]="d.label + ': primer tramo, apertura'" />
                  <span class="hr-tramo__sep">—</span>
                  <input class="rs-inp rs-inp--time" type="time" [value]="diaDe(i).cierra ?? ''"
                         (input)="fijarHora(i, 'cierra', $event)"
                         [attr.aria-label]="d.label + ': primer tramo, cierre'" />
                </div>

                <!-- Segundo tramo: muchos negocios cierran a mediodía. -->
                <div class="hr-tramo">
                  <span class="hr-tramo__et">Tarde</span>
                  <input class="rs-inp rs-inp--time" type="time" [value]="diaDe(i).abre2 ?? ''"
                         (input)="fijarHora(i, 'abre2', $event)"
                         [attr.aria-label]="d.label + ': segundo tramo, apertura'" />
                  <span class="hr-tramo__sep">—</span>
                  <input class="rs-inp rs-inp--time" type="time" [value]="diaDe(i).cierra2 ?? ''"
                         (input)="fijarHora(i, 'cierra2', $event)"
                         [attr.aria-label]="d.label + ': segundo tramo, cierre'" />
                </div>
              </div>
            } @else {
              <span class="hr-dia__off">Cerrado todo el día</span>
            }
          </div>
        }
      </div>

      <!-- ── Festivos, vacaciones y cierres puntuales ─────────────────── -->
      <div class="hr__esp">
        <h3 class="hr__esp-tit">Días especiales</h3>
        <p class="hr__ayuda">Festivos, vacaciones o cierres puntuales. Mandan sobre el horario semanal.</p>

        @if (excepciones().length) {
          <div class="hr__esp-lista">
            @for (e of excepciones(); track e.fecha) {
              <div class="hr-esp">
                <span class="hr-esp__fecha">{{ fechaLarga(e.fecha) }}</span>
                <span class="hr-esp__det">
                  {{ e.cerrado ? 'Cerrado' : (e.abre || '—') + ' — ' + (e.cierra || '—') }}
                  @if (e.motivo) { · {{ e.motivo }} }
                </span>
                <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                        (click)="quitar(e.fecha)" aria-label="Quitar día especial">
                  <rs-icon name="x" [size]="13" [stroke]="2.5" />
                </button>
              </div>
            }
          </div>
        } @else {
          <p class="hr__ayuda">Todavía no has marcado ningún día especial.</p>
        }

        <!--
          Los festivos nacionales son los mismos para todo el mundo: pedir que
          se marquen uno a uno en el calendario es trabajo que la aplicación
          puede hacer sola. Los autonómicos y los locales no se tocan —cambian
          por comunidad y por municipio— y se dice, para que nadie dé por
          cubierta la fiesta de su pueblo.
        -->
        <div class="hr__festivos">
          <button type="button" class="rs-btn rs-btn--outline rs-btn--sm"
                  [disabled]="!festivosPorAnadir().length" (click)="anadirFestivosNacionales()">
            <rs-icon name="calendar" [size]="14" [stroke]="2" />
            @if (festivosPorAnadir().length) {
              Cerrar los {{ festivosPorAnadir().length }} festivos nacionales del próximo año
            } @else {
              Festivos nacionales ya marcados
            }
          </button>
          <span class="hr__festivos-pista">
            Sólo los de ámbito estatal. Los de tu comunidad y tu municipio los añades abajo.
          </span>
        </div>

        <!--
          Calendario de selección múltiple: un puente son cuatro días y agosto
          entero son treinta. Añadirlos de uno en uno, con su motivo cada vez,
          era la parte que nadie terminaba.
        -->
        <div class="cal">
          <div class="cal__barra">
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                    (click)="cambiarMes(-1)" aria-label="Mes anterior">
              <rs-icon name="chevron-left" [size]="16" [stroke]="2.5" />
            </button>
            <strong class="cal__mes">{{ nombreMes() }}</strong>
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm"
                    (click)="cambiarMes(1)" aria-label="Mes siguiente">
              <rs-icon name="chevron-right" [size]="16" [stroke]="2.5" />
            </button>
          </div>

          <div class="cal__semana" aria-hidden="true">
            @for (d of diasSemanaCorto; track $index) { <span>{{ d }}</span> }
          </div>

          <div class="cal__rejilla" role="group" aria-label="Elige los días especiales">
            @for (c of celdas(); track c.clave) {
              <button type="button" class="cal__dia"
                      [class.cal__dia--fuera]="!c.delMes"
                      [class.cal__dia--sel]="c.seleccionado"
                      [class.cal__dia--puesto]="c.yaEsExcepcion"
                      [disabled]="c.pasado || c.yaEsExcepcion"
                      [attr.aria-pressed]="c.seleccionado"
                      [attr.title]="c.yaEsExcepcion ? 'Ya marcado como día especial' : null"
                      (click)="alternarDia(c)">
                {{ c.dia }}
              </button>
            }
          </div>

          <div class="cal__atajos">
            <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="marcarMesEntero()">
              Marcar el mes entero
            </button>
            @if (totalSeleccionados()) {
              <button type="button" class="rs-btn rs-btn--ghost rs-btn--sm" (click)="limpiarSeleccion()">
                Quitar la selección
              </button>
            }
          </div>
        </div>

        <!-- Lo que se aplica a TODOS los días marcados, para no repetirlo uno a uno. -->
        <div class="hr__esp-form">
          <input class="rs-inp" type="text" [value]="motivo()"
                 (input)="motivo.set($any($event.target).value)"
                 placeholder="Motivo (ej. vacaciones de verano)" />
          <label class="hr-check">
            <input type="checkbox" [checked]="cerradoTodoElDia()"
                   (change)="cerradoTodoElDia.set(!cerradoTodoElDia())" /> Cerrado todo el día
          </label>
          @if (!cerradoTodoElDia()) {
            <input class="rs-inp rs-inp--time" type="time" [value]="abre()"
                   (input)="abre.set($any($event.target).value)" aria-label="Abre" />
            <input class="rs-inp rs-inp--time" type="time" [value]="cierra()"
                   (input)="cierra.set($any($event.target).value)" aria-label="Cierra" />
          }
          <button type="button" class="rs-btn rs-btn--secondary rs-btn--sm"
                  [disabled]="!totalSeleccionados()" (click)="anadirSeleccionados()">
            <rs-icon name="plus" [size]="14" [stroke]="2.5" />
            @if (totalSeleccionados()) {
              Añadir {{ totalSeleccionados() }} {{ totalSeleccionados() === 1 ? 'día' : 'días' }}
            } @else {
              Elige días en el calendario
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hr { display: flex; flex-direction: column; gap: var(--sp-5); }
    .hr__ayuda { font-size: var(--f-sm); color: var(--t-400); }

    .hr__semana { display: flex; flex-direction: column; gap: var(--sp-2); }

    .hr-dia {
      display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap;
      padding: var(--sp-3) var(--sp-4);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      background: var(--c-card);
      transition: border-color var(--d-2), background var(--d-2);
    }
    .hr-dia--cerrado { background: var(--c-raised); border-style: dashed; }

    .hr-dia__cab { display: flex; align-items: center; gap: var(--sp-3); min-width: 190px; }
    .hr-dia__nombre { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); min-width: 84px; }
    .hr-dia__off { font-size: var(--f-sm); color: var(--t-400); font-style: italic; }

    .hr-dia__tramos { display: flex; gap: var(--sp-5); flex-wrap: wrap; flex: 1; }
    .hr-tramo { display: flex; align-items: center; gap: var(--sp-2); }
    .hr-tramo__et { font-size: var(--f-xs); color: var(--t-400); min-width: 48px; }
    .hr-tramo__sep { color: var(--t-400); }

    .hr-check {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      font-size: var(--f-sm); color: var(--t-300); cursor: pointer; user-select: none;
    }

    .hr__atajos { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
    .hr__atajos-pista { font-size: var(--f-sm); color: var(--t-400); }

    /* ── Días especiales ─────────────────────────────────────────────── */
    .hr__esp {
      display: flex; flex-direction: column; gap: var(--sp-3);
      padding-top: var(--sp-5); border-top: 1px solid var(--b-1);
    }
    .hr__esp-tit { font-size: var(--f-md); font-weight: var(--w-7); color: var(--t-100); }
    .hr__esp-lista { display: flex; flex-direction: column; gap: var(--sp-2); }

    .hr-esp {
      display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
      padding: var(--sp-2) var(--sp-3);
      background: var(--c-raised); border-radius: var(--r-md);
      font-size: var(--f-sm);
    }
    .hr-esp__fecha { font-weight: var(--w-6); color: var(--t-100); }
    .hr-esp__det { color: var(--t-400); flex: 1; }

    .hr__esp-form { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center; }
    .hr__esp-form .rs-inp { flex: 1; min-width: 160px; }

    /* ── Calendario ──────────────────────────────────────────────────── */
    .hr__festivos { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
    .hr__festivos-pista { font-size: var(--f-xs); color: var(--t-400); }

    /*
     * El calendario es para picar días sueltos, no para leer el mes: a ancho
     * completo ocupaba media pantalla y empujaba el resto del formulario fuera
     * de la vista. Acotado, cabe junto a la lista de días ya marcados.
     */
    .cal {
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      padding: var(--sp-3); background: var(--c-card);
      max-width: 300px;
    }
    .cal__barra { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-2); }
    .cal__mes { font-size: var(--f-sm); font-weight: var(--w-7); color: var(--t-100); text-transform: capitalize; }

    .cal__semana, .cal__rejilla { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .cal__semana span {
      text-align: center; font-size: var(--f-xs); font-weight: var(--w-7);
      color: var(--t-400); padding-bottom: var(--sp-1);
    }

    .cal__dia {
      /* 34px: sigue siendo alcanzable con el dedo sin apuntar. */
      aspect-ratio: 1; min-height: 34px;
      border: 0; border-radius: var(--r-md);
      background: transparent; color: var(--t-200);
      font-size: var(--f-xs); font-weight: var(--w-6); cursor: pointer;
      transition: background var(--d-2), color var(--d-2), transform var(--d-2);
    }
    .cal__dia:hover:not(:disabled) { background: var(--c-raised); transform: scale(1.06); }
    .cal__dia--fuera { color: var(--t-500); opacity: .45; }
    .cal__dia--sel { background: var(--dk-blue); color: #fff; }
    .cal__dia--puesto { background: var(--c-raised); color: var(--dk-gold); }
    .cal__dia:disabled { cursor: default; opacity: .4; }

    .cal__atajos { display: flex; gap: var(--sp-2); margin-top: var(--sp-2); flex-wrap: wrap; }

    @media (max-width: 719px) {
      .hr-dia { flex-direction: column; align-items: stretch; }
      .hr-dia__tramos { flex-direction: column; gap: var(--sp-2); }
      /* En móvil no hay hueco al lado: el calendario recupera el ancho. */
      .cal { max-width: none; }
    }
  `],
})
export class RsHorarioComponent {
  /** Semana día a día. Se edita en sitio: el padre recibe el array ya actualizado. */
  readonly horario = model<HorarioDia[]>(semanaVacia());
  readonly excepciones = model<ExcepcionHorario[]>([]);

  readonly dias = DIAS;
  readonly diasSemanaCorto = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  /** Lo que se aplicará a todos los días marcados en el calendario. */
  readonly motivo = signal('');
  readonly cerradoTodoElDia = signal(true);
  readonly abre = signal('');
  readonly cierra = signal('');

  private readonly mes = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  private readonly seleccionados = signal<ReadonlySet<string>>(new Set());

  /** El día `i` de la semana, con hueco vacío si el horario llega incompleto. */
  diaDe(i: number): HorarioDia {
    return this.horario()[i] ?? { dia: DIAS[i].clave, cerrado: false };
  }

  alternarCerrado(i: number): void {
    this.actualizarDia(i, (dia) => ({ ...dia, cerrado: !dia.cerrado }));
  }

  fijarHora(i: number, campo: 'abre' | 'cierra' | 'abre2' | 'cierra2', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.actualizarDia(i, (dia) => ({ ...dia, [campo]: valor }));
  }

  /** Evita teclear siete veces el mismo horario. */
  copiarLunesATodos(): void {
    const { abre, cierra, abre2, cierra2, cerrado } = this.diaDe(0);
    this.horario.update((semana) =>
      semana.map((dia, i) => (i === 0 ? dia : { ...dia, abre, cierra, abre2, cierra2, cerrado })));
  }

  readonly nombreMes = computed(() =>
    this.mes().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));

  readonly celdas = computed(() => {
    const mes = this.mes();
    const marcados = this.seleccionados();
    const yaPuestos = new Set(this.excepciones().map((e) => e.fecha));
    const hoy = hoyLocal().getTime();

    return celdasDelMes(mes).map((fecha) => {
      const clave = claveDia(fecha);
      return {
        clave,
        dia: fecha.getDate(),
        delMes: fecha.getMonth() === mes.getMonth(),
        // Marcar un festivo que ya pasó no cambia nada: se deja fuera para que
        // el calendario no invite a hacer algo sin efecto.
        pasado: fecha.getTime() < hoy,
        yaEsExcepcion: yaPuestos.has(clave),
        seleccionado: marcados.has(clave),
      };
    });
  });

  readonly totalSeleccionados = computed(() => this.seleccionados().size);

  cambiarMes(delta: number): void {
    const actual = this.mes();
    this.mes.set(new Date(actual.getFullYear(), actual.getMonth() + delta, 1));
  }

  /** Alterna un día de la selección. Los pasados y los ya puestos no se tocan. */
  alternarDia(celda: { clave: string; pasado: boolean; yaEsExcepcion: boolean }): void {
    if (celda.pasado || celda.yaEsExcepcion) return;

    this.seleccionados.update((actuales) => {
      const nuevos = new Set(actuales);
      if (nuevos.has(celda.clave)) nuevos.delete(celda.clave);
      else nuevos.add(celda.clave);
      return nuevos;
    });
  }

  /** Marca de golpe el resto del mes visible: el caso de las vacaciones. */
  marcarMesEntero(): void {
    const disponibles = this.celdas()
      .filter((c) => c.delMes && !c.pasado && !c.yaEsExcepcion)
      .map((c) => c.clave);

    this.seleccionados.update((actuales) => new Set([...actuales, ...disponibles]));
  }

  limpiarSeleccion(): void {
    this.seleccionados.set(new Set());
  }

  /**
   * Convierte la selección en días especiales, todos con el mismo motivo y el
   * mismo horario. Reemplaza los que ya existieran con esa fecha.
   */
  anadirSeleccionados(): void {
    const marcados = [...this.seleccionados()];
    if (!marcados.length) return;

    const cerrado = this.cerradoTodoElDia();
    const motivo = this.motivo() || undefined;
    const abre = cerrado ? undefined : this.abre() || undefined;
    const cierra = cerrado ? undefined : this.cierra() || undefined;

    this.excepciones.update((lista) => [
      ...lista.filter((e) => !marcados.includes(e.fecha)),
      ...marcados.map((fecha) => ({ fecha, motivo, cerrado, abre, cierra })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha)));

    this.limpiarSeleccion();
    this.motivo.set('');
    this.abre.set('');
    this.cierra.set('');
  }

  quitar(fecha: string): void {
    this.excepciones.update((lista) => lista.filter((e) => e.fecha !== fecha));
  }

  /**
   * Festivos nacionales de los próximos doce meses que todavía no están puestos.
   * Los ya marcados no se recuentan: el comercio pudo dejar uno abierto a
   * propósito y volver a cerrárselo sería pisarle una decisión suya.
   */
  readonly festivosPorAnadir = computed(() => {
    const puestos = new Set(this.excepciones().map((e) => e.fecha));
    return festivosNacionalesProximos().filter((f) => !puestos.has(f.fecha));
  });

  /** Marca como cerrados los festivos nacionales que falten. */
  anadirFestivosNacionales(): void {
    const nuevos = this.festivosPorAnadir();
    if (!nuevos.length) return;

    this.excepciones.update((lista) => [
      ...lista,
      ...nuevos.map((f) => ({ fecha: f.fecha, motivo: f.motivo, cerrado: true })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha)));
  }

  /** Fecha larga y legible para la lista de días ya puestos. */
  fechaLarga(clave: string): string {
    return desdeClaveDia(clave).toLocaleDateString('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  private actualizarDia(i: number, cambio: (dia: HorarioDia) => HorarioDia): void {
    this.horario.update((semana) => semana.map((dia, j) => (i === j ? cambio(dia) : dia)));
  }
}
