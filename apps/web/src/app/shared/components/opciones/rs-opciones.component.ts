import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { RsIconComponent } from '../icon/rs-icon.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/** Una opción elegible. `etiqueta` y `descripcion` van en español: son la clave de traducción. */
export interface OpcionElegible {
  readonly valor: string;
  readonly etiqueta: string;
  readonly icono?: string;
  readonly descripcion?: string;
  readonly deshabilitada?: boolean;
}

/**
 * Grupo de opciones seleccionables: tarjetas con icono (tipo de servicio,
 * modalidad), chips (necesidades) o control segmentado (modo de hora).
 *
 * Por dentro son `<input type="radio|checkbox">` de verdad, escondidos: así el
 * teclado (flechas en un grupo de radios, espacio en un checkbox), el lector de
 * pantalla y el foco funcionan sin reinventarlos. Antes cada pantalla tenía su
 * `.perro-card.selected` o su `.extra-item.selected` con `(click)` en un `div`,
 * que no se podía usar con teclado.
 *
 * Funciona con `formControlName`: el valor es un `string` (una opción) o un
 * `string[]` (`multiple`).
 */
@Component({
  selector: 'rs-opciones',
  standalone: true,
  imports: [RsIconComponent, TraducirPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RsOpcionesComponent), multi: true }],
  template: `
<fieldset class="op" [attr.data-variante]="variante()" [style.--op-cols]="columnas()">
  <legend class="op__leyenda" [class.op__leyenda--oculta]="!leyendaVisible()">{{ leyenda() | t }}</legend>
  <div class="op__grid">
    @for (o of opciones(); track o.valor) {
      <label class="op__item" [class.is-activa]="estaElegida(o.valor)" [class.is-deshabilitada]="o.deshabilitada || deshabilitado()">
        <input class="op__nativo" [type]="multiple() ? 'checkbox' : 'radio'" [name]="nombre"
               [value]="o.valor" [checked]="estaElegida(o.valor)"
               [disabled]="o.deshabilitada || deshabilitado()"
               (change)="alternar(o.valor)" (blur)="alTocar()" />
        @if (o.icono && variante() !== 'segmento') {
          <rs-icon class="op__icono" [name]="o.icono" [size]="variante() === 'chip' ? 16 : 22" [stroke]="1.9"></rs-icon>
        }
        <span class="op__texto">
          <span class="op__etiqueta">{{ o.etiqueta | t }}</span>
          @if (o.descripcion && variante() === 'tarjeta') {
            <span class="op__desc">{{ o.descripcion | t }}</span>
          }
        </span>
        @if (variante() === 'tarjeta' && estaElegida(o.valor)) {
          <span class="op__check" aria-hidden="true"><rs-icon name="check" [size]="12" [stroke]="3"></rs-icon></span>
        }
      </label>
    }
  </div>
</fieldset>
  `,
  styles: [`
    :host { display: block; }
    .op { border: 0; margin: 0; padding: 0; min-width: 0; }
    .op__leyenda {
      padding: 0; margin-bottom: var(--sp-2);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-200);
    }
    .op__leyenda--oculta {
      position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
    }
    .op__nativo { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }

    .op__grid { display: grid; gap: var(--sp-2); grid-template-columns: repeat(var(--op-cols, 3), minmax(0, 1fr)); }

    .op__item {
      position: relative; display: flex; align-items: center; gap: var(--sp-2);
      cursor: pointer; user-select: none; color: var(--t-200);
      transition: border-color var(--d-2), background var(--d-2), box-shadow var(--d-2), color var(--d-2);
    }
    .op__item:has(.op__nativo:focus-visible) { box-shadow: 0 0 0 3px var(--c-accent-lo); border-color: var(--c-accent); }
    .op__item.is-deshabilitada { opacity: .45; cursor: not-allowed; }
    .op__texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .op__etiqueta { font-size: var(--f-sm); font-weight: var(--w-6); line-height: 1.25; }
    .op__desc { font-size: var(--f-xs); color: var(--t-400); line-height: 1.35; }

    /* Tarjeta: icono arriba, texto debajo. Tipo de servicio, modalidad. */
    [data-variante='tarjeta'] .op__item {
      flex-direction: column; justify-content: center; text-align: center;
      min-height: 84px; padding: var(--sp-3) var(--sp-2);
      background: var(--c-card); border: 1.5px solid var(--b-2); border-radius: var(--r-lg);
    }
    [data-variante='tarjeta'] .op__texto { align-items: center; }
    [data-variante='tarjeta'] .op__icono { color: var(--dk-blue); }
    [data-variante='tarjeta'] .op__item.is-activa {
      background: var(--c-accent-lo); border-color: var(--dk-blue); color: var(--dk-blue-text);
      box-shadow: var(--sh-sm);
    }
    [data-variante='tarjeta'] .op__item:hover:not(.is-deshabilitada):not(.is-activa) { border-color: var(--b-a); }
    .op__check {
      position: absolute; top: var(--sp-2); right: var(--sp-2);
      display: grid; place-items: center; width: 18px; height: 18px;
      border-radius: var(--r-full); background: var(--dk-blue); color: var(--c-card);
    }

    /* Chip: píldora en línea. Necesidades, preferencias. */
    [data-variante='chip'] .op__grid { display: flex; flex-wrap: wrap; }
    [data-variante='chip'] .op__item {
      min-height: 40px; padding: var(--sp-2) var(--sp-3);
      background: var(--c-card); border: 1px solid var(--b-2); border-radius: var(--r-full);
    }
    [data-variante='chip'] .op__icono { color: var(--t-400); }
    [data-variante='chip'] .op__item.is-activa {
      background: var(--dk-blue); border-color: var(--dk-blue); color: var(--c-card);
      .op__icono { color: var(--dk-gold); }
    }

    /* Segmento: una barra partida. Modo de hora, personas. */
    [data-variante='segmento'] .op__grid {
      display: flex; gap: 0; padding: 3px;
      background: var(--c-surface); border: 1px solid var(--b-2); border-radius: var(--r-lg);
    }
    [data-variante='segmento'] .op__item {
      flex: 1 1 0; justify-content: center; text-align: center;
      min-height: 40px; padding: var(--sp-2); border-radius: var(--r-md);
    }
    [data-variante='segmento'] .op__item.is-activa {
      background: var(--c-card); color: var(--dk-blue); box-shadow: var(--sh-sm);
    }

    @media (max-width: 480px) {
      .op__grid { grid-template-columns: repeat(min(var(--op-cols, 3), 3), minmax(0, 1fr)); }
      [data-variante='tarjeta'] .op__item { min-height: 76px; }
    }
  `],
})
export class RsOpcionesComponent implements ControlValueAccessor {
  private static contador = 0;

  readonly opciones = input.required<readonly OpcionElegible[]>();
  readonly leyenda = input.required<string>();
  /** La leyenda siempre existe para el lector de pantalla; esto sólo decide si se ve. */
  readonly leyendaVisible = input(true);
  readonly multiple = input(false);
  readonly variante = input<'tarjeta' | 'chip' | 'segmento'>('tarjeta');
  readonly columnas = input(3);

  readonly nombre = `rs-opciones-${RsOpcionesComponent.contador++}`;
  private readonly valor = signal<string[]>([]);
  readonly deshabilitado = signal(false);
  readonly elegidas = computed(() => new Set(this.valor()));

  private alCambiar: (valor: string | string[] | null) => void = () => undefined;
  alTocar: () => void = () => undefined;

  estaElegida(valor: string): boolean {
    return this.elegidas().has(valor);
  }

  alternar(valor: string): void {
    if (!this.multiple()) {
      this.valor.set([valor]);
      this.alCambiar(valor);
      return;
    }
    const siguiente = this.estaElegida(valor)
      ? this.valor().filter((v) => v !== valor)
      : [...this.valor(), valor];
    this.valor.set(siguiente);
    this.alCambiar(siguiente);
  }

  writeValue(valor: string | string[] | null): void {
    if (Array.isArray(valor)) this.valor.set(valor);
    else this.valor.set(valor ? [valor] : []);
  }

  registerOnChange(fn: (valor: string | string[] | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }
}
