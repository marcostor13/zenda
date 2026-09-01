import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, forwardRef, inject, input, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Compara ignorando mayúsculas y tildes: "Cachorro" y "cachorró" son lo mismo. */
const normalizar = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Campo de texto con lista de sugerencias, para un solo valor.
 *
 * Es el hermano de una sola opción de `rs-tags-input`: se escribe libremente o
 * se elige del catálogo. Existe porque el `<datalist>` nativo no se puede
 * peinar —cada navegador pinta su propio desplegable, ajeno a la línea gráfica
 * de la página—, así que la lista se dibuja aquí con los tokens del design
 * system, igual que la de etiquetas.
 *
 * El valor del control es `string`: lo escrito, o la forma exacta del catálogo
 * cuando coincide, para que dos comercios no publiquen "Curso cachorro" y
 * "curso Cachorro" como si fueran cosas distintas.
 */
@Component({
  selector: 'rs-combo-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RsComboInputComponent), multi: true },
  ],
  template: `
<div class="cb">
  <input #campo type="text" class="rs-inp" autocomplete="off"
         role="combobox" aria-autocomplete="list"
         [attr.aria-label]="etiqueta() || null"
         [attr.aria-expanded]="desplegado()"
         [attr.aria-controls]="listaId"
         [attr.aria-activedescendant]="resaltada() >= 0 ? listaId + '-' + resaltada() : null"
         [placeholder]="placeholder()"
         [disabled]="deshabilitado()"
         [value]="valor()"
         (input)="escribir($event)"
         (focus)="desplegar()"
         (keydown)="teclear($event)" />

  @if (desplegado() && sugerencias().length) {
    <ul class="cb__pop" [id]="listaId" role="listbox">
      @for (opcion of sugerencias(); track opcion; let i = $index) {
        <li [id]="listaId + '-' + i" role="option" [attr.aria-selected]="i === resaltada()">
          <button type="button" class="cb__opt" [class.is-on]="i === resaltada()"
                  (mouseenter)="resaltada.set(i)" (click)="elegir(opcion)">
            {{ opcion }}
          </button>
        </li>
      }
    </ul>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .cb { position: relative; }

    .cb__pop {
      position: absolute; z-index: var(--z-3); top: calc(100% + var(--sp-1)); left: 0; right: 0;
      max-height: 240px; overflow-y: auto;
      list-style: none; padding: var(--sp-1); margin: 0;
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
    }

    .cb__opt {
      display: flex; align-items: center; gap: var(--sp-2);
      width: 100%; padding: var(--sp-2) var(--sp-3);
      border: none; border-radius: var(--r-md); background: transparent;
      font-family: var(--font); font-size: var(--f-sm); color: var(--t-100);
      text-align: left; cursor: pointer;

      &:hover, &.is-on { background: var(--c-accent-lo); color: var(--dk-blue); }
    }
  `],
})
export class RsComboInputComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  /** Catálogo de sugerencias. Puede quedar vacío: entonces solo se escribe. */
  readonly opciones = input<readonly string[]>([]);
  readonly placeholder = input('Escribe o elige de la lista…');
  readonly etiqueta = input('');

  readonly valor = signal('');
  readonly desplegado = signal(false);
  readonly resaltada = signal(-1);
  readonly deshabilitado = signal(false);

  /** Id estable por instancia para enlazar el `listbox` con el `combobox`. */
  readonly listaId = `cb-${Math.random().toString(36).slice(2, 9)}`;

  /**
   * Con el campo vacío se ofrece el catálogo entero; en cuanto se escribe, solo
   * lo que encaja. Un texto que ya coincide exactamente no despliega nada: la
   * lista solo estorbaría sobre el campo siguiente.
   */
  readonly sugerencias = computed(() => {
    const filtro = normalizar(this.valor());
    if (!filtro) return [...this.opciones()];
    const coincidencias = this.opciones().filter((o) => normalizar(o).includes(filtro));
    return coincidencias.length === 1 && normalizar(coincidencias[0]) === filtro ? [] : coincidencias;
  });

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string | null): void { this.valor.set(valor ?? ''); }
  registerOnChange(fn: (valor: string) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocar = fn; }
  setDisabledState(deshabilitado: boolean): void { this.deshabilitado.set(deshabilitado); }

  desplegar(): void {
    if (!this.deshabilitado()) this.desplegado.set(true);
  }

  escribir(evento: Event): void {
    this.valor.set((evento.target as HTMLInputElement).value);
    this.resaltada.set(-1);
    this.desplegar();
    this.alCambiar(this.valor());
  }

  teclear(evento: KeyboardEvent): void {
    const opciones = this.sugerencias();

    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        this.desplegar();
        if (opciones.length) this.resaltada.set((this.resaltada() + 1) % opciones.length);
        return;

      case 'ArrowUp':
        evento.preventDefault();
        if (opciones.length) {
          this.resaltada.set(this.resaltada() <= 0 ? opciones.length - 1 : this.resaltada() - 1);
        }
        return;

      case 'Enter':
        // Sin `preventDefault` la tecla enviaría el formulario entero.
        evento.preventDefault();
        if (this.resaltada() >= 0) this.elegir(opciones[this.resaltada()]);
        else this.cerrar();
        return;

      case 'Escape':
        this.cerrar();
        return;

      default:
        return;
    }
  }

  elegir(opcion: string): void {
    if (this.deshabilitado()) return;
    this.valor.set(opcion);
    this.alCambiar(opcion);
    this.alTocar();
    this.cerrar();
    this.campo()?.nativeElement.focus();
  }

  cerrar(): void {
    this.desplegado.set(false);
    this.resaltada.set(-1);
  }

  @HostListener('document:click', ['$event'])
  cerrarAlPulsarFuera(evento: MouseEvent): void {
    if (!this.desplegado()) return;
    if (!this.host.nativeElement.contains(evento.target as Node)) {
      // Lo escrito se conserva tal cual: el campo admite nombres propios, así
      // que salir del campo no puede descartar lo que no está en el catálogo.
      this.cerrar();
      this.alTocar();
    }
  }
}
