import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, forwardRef, inject, input, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  PAISES_EUROPA, PAIS_POR_DEFECTO, PaisTelefono, paisDelTelefono,
} from '../../catalogos/paises.catalogo';
import { RsIconComponent } from '../icon/rs-icon.component';
import { RsBanderaComponent } from '../bandera/rs-bandera.component';
import { TraducirPipe } from '../../../core/i18n/traducir.pipe';

/** Compara ignorando mayúsculas y tildes: "espana" encuentra "España". */
const normalizar = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Campo de teléfono con prefijo de país separado del número.
 *
 * El valor del control es el teléfono completo en formato internacional
 * (`+34600000000`), que es lo que espera `@IsPhoneNumber()` en el API: un número
 * escrito sin prefijo se rechazaba en el registro y el usuario no entendía por qué.
 *
 * Arranca en España, el mercado de partida, para que la mayoría no tenga que
 * tocar el selector.
 */
@Component({
  selector: 'rs-phone-input',
  standalone: true,
  imports: [
    TraducirPipe, RsIconComponent, RsBanderaComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RsPhoneInputComponent), multi: true },
  ],
  template: `
<div class="ph" [class.is-disabled]="deshabilitado()">
  <div class="ph__box" [class.is-error]="error()">
    <button type="button" class="ph__pais" (click)="alternar()"
            [disabled]="deshabilitado()"
            [attr.aria-expanded]="desplegado()" aria-haspopup="listbox"
            [attr.aria-label]="'Prefijo: ' + pais().nombre + ' ' + pais().prefijo">
      <rs-bandera class="ph__bandera" [codigo]="pais().iso" [alto]="14" />
      <span class="ph__prefijo">{{ pais().prefijo }}</span>
      <rs-icon name="chevron-down" [size]="13" [stroke]="2.5"></rs-icon>
    </button>

    <span class="ph__sep" aria-hidden="true"></span>

    <input #campo type="tel" class="ph__num" autocomplete="tel-national"
           [id]="inputId()"
           [attr.aria-label]="etiqueta() || null"
           [placeholder]="placeholder()"
           [disabled]="deshabilitado()"
           [value]="numero()"
           (input)="escribirNumero($event)"
           (blur)="alTocar()" />
  </div>

  @if (desplegado()) {
    <div class="ph__pop" role="dialog" [attr.aria-label]="'Elegir prefijo de país' | t">
      <input #buscador type="text" class="ph__buscar" autocomplete="off"
             [placeholder]="'Busca un país o prefijo…' | t"
             [value]="filtro()"
             (input)="filtrar($event)" />

      @if (paisesFiltrados().length) {
        <ul class="ph__lista" role="listbox">
          @for (p of paisesFiltrados(); track p.iso) {
            <li role="option" [attr.aria-selected]="p.iso === pais().iso">
              <button type="button" class="ph__opt" [class.is-on]="p.iso === pais().iso"
                      (click)="elegirPais(p)">
                <rs-bandera class="ph__bandera" [codigo]="p.iso" [alto]="14" />
                <span class="ph__nombre">{{ p.nombre }}</span>
                <span class="ph__dial">{{ p.prefijo }}</span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="ph__vacio">Ningún país europeo coincide con «{{ filtro() }}».</p>
      }
    </div>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .ph { position: relative; }

    .ph__box {
      display: flex; align-items: center;
      min-height: 44px;
      background: var(--c-card);
      border: 1px solid var(--b-2); border-radius: var(--r-lg);
      transition: border-color var(--d-2), box-shadow var(--d-2);

      &:focus-within { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
      &.is-error { border-color: var(--c-error, #DC2626); }
    }
    .is-disabled .ph__box { opacity: .6; }

    .ph__pais {
      display: inline-flex; align-items: center; gap: var(--sp-1);
      flex-shrink: 0; padding: var(--sp-2) var(--sp-3);
      border: none; background: transparent; cursor: pointer;
      font-family: var(--font); font-size: var(--f-sm); color: var(--t-100);
      border-radius: var(--r-lg) 0 0 var(--r-lg);

      &:hover:not(:disabled) { background: var(--c-accent-lo); }
      &:disabled { cursor: not-allowed; }
    }
    .ph__bandera { flex: none; }
    .ph__prefijo { font-weight: var(--w-6); }

    .ph__sep { width: 1px; align-self: stretch; margin-block: var(--sp-2); background: var(--b-2); }

    /*
     * width:0 no es decorativo: un input arrastra un ancho intrínseco
     * de su atributo size (20 caracteres ≈ 239px). Ese ancho se cuela en
     * el min-content del campo entero, así que en pantallas estrechas el
     * teléfono no dejaba encoger a la tarjeta que lo contiene y desbordaba
     * la página por la derecha. Con width:0 + flex-grow ocupa lo mismo a la
     * vista, pero deja de imponer un mínimo.
     */
    .ph__num {
      width: 0; flex: 1 1 auto; min-width: 0;
      padding: var(--sp-2) var(--sp-3);
      border: none; outline: none; background: transparent;
      font-family: var(--font); font-size: var(--f-base); color: var(--t-100);
      &::placeholder { color: var(--t-400); }
      &:disabled { cursor: not-allowed; }
    }

    .ph__pop {
      position: absolute; z-index: var(--z-3); top: calc(100% + var(--sp-1)); left: 0;
      width: min(320px, 92vw);
      padding: var(--sp-2);
      background: var(--c-card);
      border: 1px solid var(--b-1); border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
    }

    .ph__buscar {
      width: 100%; padding: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-2);
      border: 1px solid var(--b-2); border-radius: var(--r-md);
      font-family: var(--font); font-size: var(--f-sm); color: var(--t-100);
      background: var(--c-base, transparent);
      &:focus { outline: none; border-color: var(--c-accent); }
    }

    .ph__lista { list-style: none; max-height: 260px; overflow-y: auto; }

    .ph__opt {
      display: flex; align-items: center; gap: var(--sp-2);
      width: 100%; padding: var(--sp-2) var(--sp-3);
      border: none; border-radius: var(--r-md); background: transparent;
      font-family: var(--font); font-size: var(--f-sm); color: var(--t-100);
      text-align: left; cursor: pointer;

      &:hover, &.is-on { background: var(--c-accent-lo); color: var(--dk-blue); }
    }
    .ph__nombre { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ph__dial { flex-shrink: 0; font-weight: var(--w-6); color: var(--t-400); }

    .ph__vacio { padding: var(--sp-3); font-size: var(--f-sm); color: var(--t-400); }
  `],
})
export class RsPhoneInputComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  readonly inputId = input('');
  readonly etiqueta = input('');
  readonly placeholder = input('600 000 000');
  readonly error = input(false);

  readonly paises = PAISES_EUROPA;

  readonly pais = signal<PaisTelefono>(
    PAISES_EUROPA.find((p) => p.iso === PAIS_POR_DEFECTO) ?? PAISES_EUROPA[0],
  );
  readonly numero = signal('');
  readonly desplegado = signal(false);
  readonly filtro = signal('');
  readonly deshabilitado = signal(false);

  readonly paisesFiltrados = computed(() => {
    const texto = normalizar(this.filtro());
    if (!texto) return this.paises;
    // El prefijo se busca con o sin `+`: mucha gente teclea "34" directamente.
    const sinMas = texto.replace('+', '');
    return this.paises.filter(
      (p) => normalizar(p.nombre).includes(texto) || p.prefijo.replace('+', '').startsWith(sinMas),
    );
  });

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocarFn: () => void = () => undefined;

  writeValue(valor: string | null): void {
    const limpio = (valor ?? '').replace(/[\s()-]/g, '');

    if (!limpio) {
      this.numero.set('');
      return;
    }

    const encontrado = paisDelTelefono(limpio);
    if (encontrado) {
      this.pais.set(encontrado);
      this.numero.set(limpio.slice(encontrado.prefijo.length));
      return;
    }

    // Números antiguos guardados sin prefijo: se asumen del país por defecto.
    this.numero.set(limpio.replace('+', ''));
  }

  registerOnChange(fn: (valor: string) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocarFn = fn; }
  setDisabledState(deshabilitado: boolean): void { this.deshabilitado.set(deshabilitado); }

  alTocar(): void { this.alTocarFn(); }

  alternar(): void {
    if (this.deshabilitado()) return;
    const abriendo = !this.desplegado();
    this.desplegado.set(abriendo);
    this.filtro.set('');
    // El foco va al buscador: se puede filtrar sin tocar el ratón.
    if (abriendo) setTimeout(() => this.buscador()?.nativeElement.focus(), 0);
  }

  cerrar(): void {
    this.desplegado.set(false);
    this.filtro.set('');
  }

  filtrar(evento: Event): void {
    this.filtro.set((evento.target as HTMLInputElement).value);
  }

  elegirPais(pais: PaisTelefono): void {
    this.pais.set(pais);
    this.cerrar();
    this.emitir();
    this.campo()?.nativeElement.focus();
  }

  escribirNumero(evento: Event): void {
    // Solo dígitos: el prefijo lo pone el selector, y espacios o guiones
    // rompen la validación E.164 del API.
    const limpio = (evento.target as HTMLInputElement).value.replace(/\D/g, '');
    this.numero.set(limpio);
    this.emitir();
  }

  @HostListener('document:click', ['$event'])
  cerrarAlPulsarFuera(evento: MouseEvent): void {
    if (!this.desplegado()) return;
    if (!this.host.nativeElement.contains(evento.target as Node)) this.cerrar();
  }

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.desplegado()) this.cerrar();
  }

  /** Sin número no se emite solo el prefijo: dejaría "+34" en campos opcionales. */
  private emitir(): void {
    this.alCambiar(this.numero() ? `${this.pais().prefijo}${this.numero()}` : '');
    this.alTocarFn();
  }
}
