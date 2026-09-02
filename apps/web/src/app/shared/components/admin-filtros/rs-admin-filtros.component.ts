import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

export interface OpcionFiltro {
  readonly valor: string;
  readonly label: string;
}

export interface GrupoFiltro {
  readonly clave: string;
  readonly label: string;
  /** `pastillas` para pocas opciones excluyentes; `select` para listas largas. */
  readonly tipo: 'pastillas' | 'select';
  readonly opciones: ReadonlyArray<OpcionFiltro>;
  /** Texto de la opción vacía. Por defecto "Todos". */
  readonly vacio?: string;
}

/** Lo elegido en cada grupo, por su clave. Cadena vacía = sin filtrar. */
export type ValoresFiltro = Record<string, string>;

interface ChipActivo {
  readonly clave: string;
  readonly texto: string;
}

/**
 * Barra de filtros de las vistas de administración.
 *
 * Recoge dos problemas del panel:
 *
 * 1. **No se notaba que un filtro había hecho algo.** Al pulsar "Todos" o
 *    "Pendientes" sólo cambiaba de color la pastilla; nada decía qué se estaba
 *    mirando ni cuántos resultados quedaban. Ahora lo aplicado se enseña como
 *    pastillas quitables una a una, con el recuento al lado en una región
 *    `aria-live` para que también se anuncie a un lector de pantalla.
 *
 * 2. **Eran demasiadas opciones a la vista**: seis pastillas de estado y tres
 *    desplegables ocupaban media pantalla antes de la primera fila de la tabla.
 *    Se pliegan tras un botón "Filtros" con el número de filtros aplicados,
 *    igual que en el listado público (`rs-listado`), del que se conserva el
 *    lenguaje visual: pastilla redonda, contador en azul e panel inferior.
 */
@Component({
  selector: 'rs-admin-filtros',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TraducirPipe, RsIconComponent
  ],
  template: `
    <div class="af">
      <div class="af__barra">
        @if (conBuscador()) {
          <div class="af__buscar">
            <rs-icon name="search" [size]="16" [stroke]="2" class="af__buscar-ico" />
            <input class="rs-inp af__buscar-inp" type="search"
                   [attr.placeholder]="buscarPlaceholder()"
                   [attr.aria-label]="buscarPlaceholder()"
                   [value]="buscar()"
                   (input)="buscarCambio.emit($any($event.target).value)" />
          </div>
        }

        <button type="button" class="af__btn" [class.is-on]="abierto()"
                [attr.aria-expanded]="abierto()" (click)="abrir()">
          <rs-icon name="list" [size]="15" [stroke]="2" />
          Filtros
          @if (numActivos()) { <span class="af__btn-n">{{ numActivos() }}</span> }
        </button>

        <p class="af__count" aria-live="polite">
          <strong>{{ total() }}</strong> {{ total() === 1 ? etiquetaSingular() : etiquetaPlural() }}
        </p>
      </div>

      <!-- Lo aplicado, quitable de uno en uno: es la señal de que el filtro hizo algo. -->
      @if (chips().length) {
        <div class="af__activos">
          @for (c of chips(); track c.clave) {
            <button type="button" class="af__activo" (click)="quitar(c.clave)">
              {{ c.texto }}
              <rs-icon name="x" [size]="12" [stroke]="2.5" />
            </button>
          }
          <button type="button" class="af__activo af__activo--limpiar" (click)="limpiar()">
            {{ 'Limpiar filtros' | t }}
          </button>
        </div>
      }
    </div>

    @if (abierto()) {
      <div class="af__velo" (click)="cerrar()" aria-hidden="true"></div>
    }

    <aside class="af__panel" [class.is-abierto]="abierto()"
           [attr.role]="abierto() ? 'dialog' : null"
           [attr.aria-modal]="abierto() ? 'true' : null"
           [attr.aria-label]="abierto() ? 'Filtros' : null">
      <div class="af__asa" aria-hidden="true"></div>
      <div class="af__head">
        <h2>{{ 'Filtros' | t }}</h2>
        <button type="button" class="af__cerrar" (click)="cerrar()" [attr.aria-label]="'Cerrar filtros' | t">
          <rs-icon name="x" [size]="18" [stroke]="2.5" />
        </button>
      </div>

      <div class="af__cuerpo">
        @for (g of grupos(); track g.clave) {
          <div class="af__grupo">
            <h3 class="af__grupo-tit">{{ g.label | t }}</h3>

            @if (g.tipo === 'pastillas') {
              <div class="af__opciones">
                <button type="button" class="af__op" [class.is-sel]="!valorDe(g.clave)"
                        [attr.aria-pressed]="!valorDe(g.clave)"
                        (click)="fijar(g.clave, '')">{{ g.vacio ?? 'Todos' }}</button>
                @for (o of g.opciones; track o.valor) {
                  <button type="button" class="af__op" [class.is-sel]="valorDe(g.clave) === o.valor"
                          [attr.aria-pressed]="valorDe(g.clave) === o.valor"
                          (click)="fijar(g.clave, o.valor)">{{ o.label | t }}</button>
                }
              </div>
            } @else {
              <select class="rs-inp af__select" [value]="valorDe(g.clave)"
                      [attr.aria-label]="g.label"
                      (change)="fijar(g.clave, $any($event.target).value)">
                <option value="">{{ g.vacio ?? 'Todos' }}</option>
                @for (o of g.opciones; track o.valor) {
                  <option [value]="o.valor">{{ o.label | t }}</option>
                }
              </select>
            }
          </div>
        }
      </div>

      <div class="af__pie">
        @if (numActivos()) {
          <button type="button" class="rs-btn rs-btn--ghost" (click)="limpiar()">{{ 'Limpiar' | t }}</button>
        }
        <button type="button" class="rs-btn rs-btn--primary rs-btn--block" (click)="cerrar()">
          Ver {{ total() }} {{ total() === 1 ? etiquetaSingular() : etiquetaPlural() }}
        </button>
      </div>
    </aside>
  `,
  styles: [`
    :host { display: block; }

    .af { margin-bottom: var(--sp-5); }
    .af__barra { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }

    .af__buscar { position: relative; flex: 1 1 240px; max-width: 360px; min-width: 0; }
    .af__buscar-ico {
      position: absolute; left: var(--sp-3); top: 50%; transform: translateY(-50%);
      color: var(--t-400); pointer-events: none;
    }
    .af__buscar-inp { height: 44px; padding-block: 0; padding-left: var(--sp-10); }

    /* Misma pastilla que el boton de filtros del listado publico. */
    .af__btn {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2);
      height: 44px; padding-inline: var(--sp-4);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-200);
      font-family: var(--font); font-size: var(--f-sm); font-weight: var(--w-6);
      cursor: pointer; white-space: nowrap;
      transition: border-color var(--d-2), background var(--d-2), color var(--d-2);
    }
    .af__btn:hover { border-color: var(--b-a); background: var(--c-raised); color: var(--dk-blue); }
    .af__btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
    .af__btn.is-on { background: var(--dk-blue); border-color: var(--dk-blue); color: #fff; }
    .af__btn-n {
      display: grid; place-items: center; min-width: 18px; height: 18px; padding-inline: 5px;
      border-radius: var(--r-full); background: var(--dk-blue); color: #fff;
      font-size: var(--f-xs); font-weight: var(--w-7);
    }
    .af__btn.is-on .af__btn-n { background: #fff; color: var(--dk-blue); }

    .af__count { margin-left: auto; font-size: var(--f-sm); color: var(--t-400); white-space: nowrap; }
    .af__count strong { color: var(--t-100); font-weight: var(--w-7); }

    .af__activos { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-3); }
    .af__activo {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      min-height: 32px; padding: var(--sp-1) var(--sp-3);
      border: 1px solid var(--c-accent); border-radius: var(--r-full);
      background: var(--c-accent-lo); color: var(--dk-blue);
      font-family: var(--font); font-size: var(--f-xs); font-weight: var(--w-6);
      cursor: pointer; transition: background var(--d-2);
    }
    .af__activo:hover { background: rgba(8,37,139,.16); }
    .af__activo--limpiar {
      border-style: dashed; border-color: var(--b-2);
      background: transparent; color: var(--t-400);
    }

    .af__velo {
      position: fixed; inset: 0; z-index: calc(var(--z-4) - 1);
      background: rgba(0, 19, 93, .45);
    }

    /* Panel inferior, igual que el de filtros del listado publico. */
    .af__panel {
      position: fixed; inset: auto 0 0 0; z-index: var(--z-4);
      max-height: 88dvh; display: flex; flex-direction: column;
      background: var(--c-card);
      border-radius: var(--r-2xl) var(--r-2xl) 0 0;
      box-shadow: 0 -12px 40px rgba(8, 37, 139, .24);
      transform: translateY(100%);
      transition: transform var(--d-3);
      will-change: transform;
    }
    .af__panel.is-abierto { transform: translateY(0); }

    .af__asa {
      width: 40px; height: 4px; margin: var(--sp-3) auto 0;
      border-radius: var(--r-full); background: var(--b-2);
    }
    .af__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--sp-3) var(--sp-5); border-bottom: 1px solid var(--b-1);

      h2 { font-family: var(--font-display); font-size: var(--f-lg); color: var(--dk-blue); }
    }
    .af__cerrar {
      display: grid; place-items: center; width: 36px; height: 36px;
      border: none; border-radius: var(--r-full); background: transparent;
      color: var(--t-400); cursor: pointer;
    }
    .af__cerrar:hover { background: var(--c-raised); color: var(--dk-blue); }

    .af__cuerpo {
      padding: var(--sp-5); overflow-y: auto; overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch; min-height: 0;
      display: flex; flex-direction: column; gap: var(--sp-5);
    }
    .af__grupo-tit {
      font-size: var(--f-xs); font-family: var(--font-accent); font-weight: var(--w-7);
      letter-spacing: .08em; text-transform: uppercase; color: var(--t-400);
      margin-bottom: var(--sp-3);
    }
    .af__opciones { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .af__op {
      min-height: 36px; padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--b-2); border-radius: var(--r-full);
      background: var(--c-card); color: var(--t-200);
      font-family: var(--font); font-size: var(--f-sm); font-weight: var(--w-6);
      cursor: pointer; transition: all var(--d-2);
    }
    .af__op:hover { border-color: var(--b-a); color: var(--dk-blue); }
    .af__op.is-sel { background: var(--dk-blue); border-color: var(--dk-blue); color: #fff; }
    .af__select { height: 44px; padding-block: 0; padding-right: var(--sp-8); }

    .af__pie {
      display: flex; gap: var(--sp-3); padding: var(--sp-4) var(--sp-5);
      padding-bottom: calc(var(--sp-4) + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--b-1);
    }

    /* El panel cabe centrado en cuanto hay sitio; abajo del todo solo en movil. */
    @media (min-width: 700px) {
      .af__panel {
        inset: 50% auto auto 50%;
        transform: translate(-50%, -50%) scale(.96);
        opacity: 0;
        pointer-events: none;
        width: min(560px, calc(100vw - var(--sp-8)));
        max-height: min(80dvh, 720px);
        border-radius: var(--r-2xl);
        transition: opacity var(--d-2), transform var(--d-2);
      }
      .af__panel.is-abierto {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
        pointer-events: auto;
      }
      .af__asa { display: none; }
    }

    @media (max-width: 640px) {
      .af__barra { gap: var(--sp-2); }
      .af__buscar { flex: 1 1 100%; max-width: none; }
      .af__btn { flex: 1; }
      .af__count { margin-left: 0; }
    }
  `],
})
export class RsAdminFiltrosComponent {
  readonly grupos = input.required<ReadonlyArray<GrupoFiltro>>();
  readonly valores = input.required<ValoresFiltro>();
  readonly total = input(0);
  readonly etiquetaSingular = input('resultado');
  readonly etiquetaPlural = input('resultados');

  readonly conBuscador = input(true);
  readonly buscar = input('');
  readonly buscarPlaceholder = input('Buscar…');

  readonly cambio = output<ValoresFiltro>();
  readonly buscarCambio = output<string>();

  readonly abierto = signal(false);

  /** Cuántos filtros están puestos: es el número del botón. */
  readonly numActivos = computed(
    () => Object.values(this.valores()).filter((v) => !!v).length,
  );

  /** Lo aplicado, con su etiqueta legible, para pintarlo como pastillas. */
  readonly chips = computed<ChipActivo[]>(() =>
    this.grupos()
      .map((g) => {
        const valor = this.valores()[g.clave];
        if (!valor) return null;
        const opcion = g.opciones.find((o) => o.valor === valor);
        return { clave: g.clave, texto: `${g.label}: ${opcion?.label ?? valor}` };
      })
      .filter((c): c is ChipActivo => c !== null),
  );

  valorDe(clave: string): string {
    return this.valores()[clave] ?? '';
  }

  abrir(): void {
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  /**
   * Se emite en cuanto se toca la opción, sin esperar a cerrar el panel: el
   * recuento del pie se actualiza a la vez y así se ve lo que hace el filtro.
   */
  fijar(clave: string, valor: string): void {
    this.cambio.emit({ ...this.valores(), [clave]: valor });
  }

  quitar(clave: string): void {
    this.fijar(clave, '');
  }

  limpiar(): void {
    const vacios: ValoresFiltro = {};
    for (const g of this.grupos()) vacios[g.clave] = '';
    this.cambio.emit(vacios);
  }
}
