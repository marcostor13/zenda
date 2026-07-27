import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, forwardRef, inject, input, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { RsIconComponent } from '../icon/rs-icon.component';

/** Compara ignorando mayúsculas y tildes: "Alergia" y "alergía" son lo mismo. */
const normalizar = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Campo de etiquetas con lista de sugerencias.
 *
 * Sustituye a los antiguos campos "separados por comas": escribir listas a mano
 * producía entradas con espacios sobrantes, duplicadas o mal escritas que luego
 * no casaban con ningún filtro del buscador. Aquí se elige de un catálogo y cada
 * elección queda como una etiqueta suelta que se puede quitar.
 *
 * El valor del control es `string[]`. Sigue admitiendo pegar texto con comas:
 * se reparte en etiquetas, para no perder lo que el comercio ya tenía escrito.
 */
@Component({
  selector: 'rs-tags-input',
  standalone: true,
  imports: [RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RsTagsInputComponent), multi: true },
  ],
  template: `
<div class="tg" [class.is-disabled]="deshabilitado()">
  <div class="tg__box" (click)="enfocar()">
    @for (tag of valor(); track tag) {
      <span class="tg__tag">
        {{ tag }}
        <button type="button" class="tg__x" (click)="quitar(tag); $event.stopPropagation()"
                [attr.aria-label]="'Quitar ' + tag" [disabled]="deshabilitado()">
          <rs-icon name="x" [size]="12" [stroke]="2.5"></rs-icon>
        </button>
      </span>
    }

    <input #campo type="text" class="tg__input"
           role="combobox" autocomplete="off"
           [attr.aria-label]="etiqueta() || null"
           [attr.aria-expanded]="desplegado()"
           [attr.aria-controls]="listaId"
           [attr.aria-activedescendant]="resaltada() >= 0 ? listaId + '-' + resaltada() : null"
           [placeholder]="valor().length ? '' : placeholder()"
           [disabled]="deshabilitado() || alTope()"
           [value]="borrador()"
           (input)="escribir($event)"
           (focus)="desplegar()"
           (keydown)="teclear($event)" />
  </div>

  @if (desplegado() && (sugerencias().length || puedeCrearBorrador())) {
    <ul class="tg__pop" [id]="listaId" role="listbox">
      @for (opcion of sugerencias(); track opcion; let i = $index) {
        <li [id]="listaId + '-' + i" role="option" [attr.aria-selected]="i === resaltada()">
          <button type="button" class="tg__opt" [class.is-on]="i === resaltada()"
                  (mouseenter)="resaltada.set(i)" (click)="anadir(opcion)">
            {{ opcion }}
          </button>
        </li>
      }
      @if (puedeCrearBorrador()) {
        <li role="option" [attr.aria-selected]="false">
          <button type="button" class="tg__opt tg__opt--nueva" (click)="anadir(borrador())">
            <rs-icon name="plus" [size]="13" [stroke]="2.5"></rs-icon>
            Añadir «{{ borrador().trim() }}»
          </button>
        </li>
      }
    </ul>
  }

  @if (alTope()) {
    <p class="tg__aviso">Has alcanzado el máximo de {{ maximo() }}.</p>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .tg { position: relative; }

    .tg__box {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2);
      min-height: 44px; padding: var(--sp-2) var(--sp-3);
      background: var(--c-card);
      border: 1px solid var(--b-2); border-radius: var(--r-lg);
      cursor: text;
      transition: border-color var(--d-2), box-shadow var(--d-2);

      &:focus-within { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
    }
    .is-disabled .tg__box { opacity: .6; cursor: not-allowed; }

    .tg__tag {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      padding: var(--sp-1) var(--sp-2);
      font-size: var(--f-sm); font-weight: var(--w-6); color: var(--dk-blue);
      background: var(--c-accent-lo); border: 1px solid rgba(8,37,139,.18);
      border-radius: var(--r-full);
      max-width: 100%; word-break: break-word;
    }
    .tg__x {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0; border: none; background: transparent; color: inherit;
      cursor: pointer; opacity: .65;
      &:hover:not(:disabled) { opacity: 1; }
      &:disabled { cursor: not-allowed; }
    }

    .tg__input {
      flex: 1; min-width: 120px;
      border: none; outline: none; background: transparent;
      font-family: var(--font); font-size: var(--f-base); color: var(--t-100);
      &::placeholder { color: var(--t-400); }
      &:disabled { cursor: not-allowed; }
    }

    .tg__pop {
      position: absolute; z-index: var(--z-3); top: calc(100% + var(--sp-1)); left: 0; right: 0;
      max-height: 240px; overflow-y: auto;
      list-style: none; padding: var(--sp-1);
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
    }

    .tg__opt {
      display: flex; align-items: center; gap: var(--sp-2);
      width: 100%; padding: var(--sp-2) var(--sp-3);
      border: none; border-radius: var(--r-md); background: transparent;
      font-family: var(--font); font-size: var(--f-sm); color: var(--t-100);
      text-align: left; cursor: pointer;

      &:hover, &.is-on { background: var(--c-accent-lo); color: var(--dk-blue); }
    }
    .tg__opt--nueva { font-weight: var(--w-6); color: var(--dk-blue); }

    .tg__aviso { margin-top: var(--sp-1); font-size: var(--f-xs); color: var(--t-400); }
  `],
})
export class RsTagsInputComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  /** Catálogo de sugerencias. Puede quedar vacío: entonces solo se escribe. */
  readonly opciones = input<readonly string[]>([]);
  readonly placeholder = input('Escribe o elige de la lista…');
  /** `false` para catálogos cerrados (especies, temperamentos…). */
  readonly permiteNuevos = input(true);
  readonly etiqueta = input('');
  readonly maximo = input<number | null>(null);

  readonly valor = signal<string[]>([]);
  readonly borrador = signal('');
  readonly desplegado = signal(false);
  readonly resaltada = signal(-1);
  readonly deshabilitado = signal(false);

  /** Id estable por instancia para enlazar el `listbox` con el `combobox`. */
  readonly listaId = `tg-${Math.random().toString(36).slice(2, 9)}`;

  readonly alTope = computed(() => {
    const tope = this.maximo();
    return tope !== null && this.valor().length >= tope;
  });

  readonly sugerencias = computed(() => {
    const elegidas = new Set(this.valor().map(normalizar));
    const filtro = normalizar(this.borrador());
    return this.opciones()
      .filter((o) => !elegidas.has(normalizar(o)))
      .filter((o) => !filtro || normalizar(o).includes(filtro));
  });

  /** El texto escrito se puede añadir si es nuevo y el campo admite libres. */
  readonly puedeCrearBorrador = computed(() => {
    const texto = this.borrador().trim();
    if (!texto || !this.permiteNuevos()) return false;
    const yaEsta = [...this.valor(), ...this.opciones()].some((v) => normalizar(v) === normalizar(texto));
    return !yaEsta;
  });

  private alCambiar: (valor: string[]) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string[] | string | null): void {
    // Admite el formato antiguo (cadena con comas) para no romper datos guardados.
    if (typeof valor === 'string') this.valor.set(this.repartir(valor));
    else this.valor.set(valor ?? []);
  }

  registerOnChange(fn: (valor: string[]) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocar = fn; }
  setDisabledState(deshabilitado: boolean): void { this.deshabilitado.set(deshabilitado); }

  enfocar(): void {
    if (this.deshabilitado()) return;
    this.campo()?.nativeElement.focus();
  }

  desplegar(): void {
    if (!this.deshabilitado()) this.desplegado.set(true);
  }

  escribir(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;

    // Pegar "a, b, c" reparte en etiquetas en lugar de dejar una sola entrada.
    if (texto.includes(',')) {
      const partes = this.repartir(texto);
      const ultimo = texto.trimEnd().endsWith(',') ? '' : partes.pop() ?? '';
      partes.forEach((p) => this.anadirSilencioso(p));
      this.emitir();
      this.borrador.set(ultimo);
    } else {
      this.borrador.set(texto);
    }

    this.resaltada.set(-1);
    this.desplegar();
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

      case 'Enter': {
        // Sin `preventDefault` la tecla enviaría el formulario entero.
        evento.preventDefault();
        const elegida = this.resaltada() >= 0 ? opciones[this.resaltada()] : this.borrador();
        if (elegida?.trim()) this.anadir(elegida);
        return;
      }

      case 'Escape':
        this.cerrar();
        return;

      case 'Backspace':
        // Borrar hacia atrás con el campo vacío quita la última etiqueta.
        if (!this.borrador() && this.valor().length) {
          this.quitar(this.valor()[this.valor().length - 1]);
        }
        return;

      default:
        return;
    }
  }

  anadir(texto: string): void {
    if (this.deshabilitado()) return;
    if (this.anadirSilencioso(texto)) this.emitir();
    this.borrador.set('');
    this.resaltada.set(-1);
    this.enfocar();
  }

  quitar(tag: string): void {
    if (this.deshabilitado()) return;
    this.valor.update((lista) => lista.filter((t) => t !== tag));
    this.emitir();
  }

  cerrar(): void {
    this.desplegado.set(false);
    this.resaltada.set(-1);
  }

  @HostListener('document:click', ['$event'])
  cerrarAlPulsarFuera(evento: MouseEvent): void {
    if (!this.desplegado()) return;
    if (!this.host.nativeElement.contains(evento.target as Node)) {
      this.cerrar();
      this.alTocar();
    }
  }

  /** Añade sin emitir; devuelve si la lista cambió. */
  private anadirSilencioso(texto: string): boolean {
    const limpio = texto.trim();
    if (!limpio || this.alTope()) return false;
    if (!this.permiteNuevos() && !this.opciones().some((o) => normalizar(o) === normalizar(limpio))) return false;
    if (this.valor().some((t) => normalizar(t) === normalizar(limpio))) return false;

    // Se guarda la forma del catálogo, no lo tecleado: evita "Playa" y "playa".
    const delCatalogo = this.opciones().find((o) => normalizar(o) === normalizar(limpio));
    this.valor.update((lista) => [...lista, delCatalogo ?? limpio]);
    return true;
  }

  private repartir(texto: string): string[] {
    return texto.split(',').map((t) => t.trim()).filter(Boolean);
  }

  private emitir(): void {
    this.alCambiar(this.valor());
    this.alTocar();
  }
}
