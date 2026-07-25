import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, forwardRef, inject, input, output, signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import { CoordenadasLugar, GeoService, SugerenciaLugar } from '../../../core/geo/geo.service';
import { RsIconComponent } from '../icon/rs-icon.component';

/**
 * Población elegida por el usuario. Incluye el `placeId` porque quien la recibe
 * puede necesitarlo después (por ejemplo, para calcular un trayecto) sin volver
 * a resolver la búsqueda.
 */
export interface LugarElegido extends CoordenadasLugar {
  placeId: string;
}

/**
 * Campo de población con sugerencias desde la **primera letra** (P6). Es un
 * `ControlValueAccessor` para encajar tal cual en el formulario del buscador.
 *
 * Degrada a texto libre: si el proxy de geo no responde no aparece ninguna
 * lista, pero lo escrito sigue siendo una búsqueda válida por nombre de ciudad.
 */
@Component({
  selector: 'rs-place-autocomplete',
  standalone: true,
  imports: [RsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RsPlaceAutocompleteComponent),
      multi: true,
    },
  ],
  template: `
<div class="pa">
  <div class="pa__ctrl">
    <rs-icon name="map-pin" [size]="18" [stroke]="2"></rs-icon>
    <input class="pa__inp" type="text" role="combobox" autocomplete="off"
           [id]="inputId()"
           [value]="texto()"
           [placeholder]="placeholder()"
           [disabled]="deshabilitado()"
           [attr.aria-expanded]="hayLista()"
           [attr.aria-controls]="listaId"
           [attr.aria-activedescendant]="activoId()"
           aria-autocomplete="list"
           (input)="escribir($event)"
           (focus)="alEnfocar()"
           (blur)="alPerderFoco()"
           (keydown)="teclear($event)" />
    @if (cargando()) { <span class="pa__spinner" aria-hidden="true"></span> }
  </div>

  @if (hayLista()) {
    <ul class="pa__list" role="listbox" [id]="listaId">
      @for (s of sugerencias(); track s.placeId; let i = $index) {
        <li class="pa__item" role="option"
            [id]="listaId + '-' + i"
            [class.is-active]="indiceActivo() === i"
            [attr.aria-selected]="indiceActivo() === i"
            (mousedown)="elegir(s)"
            (mouseenter)="indiceActivo.set(i)">
          <rs-icon name="map-pin" [size]="15" [stroke]="2" class="pa__item-icon"></rs-icon>
          <span class="pa__item-text">
            <strong>{{ s.principal }}</strong>
            @if (s.secundario) { <em>{{ s.secundario }}</em> }
          </span>
        </li>
      }
    </ul>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .pa { position: relative; }

    .pa__ctrl { display: flex; align-items: center; gap: var(--sp-2); color: var(--t-400); }

    .pa__inp {
      flex: 1; min-width: 0;
      border: none; outline: none; background: transparent;
      padding-block: 2px;
      font-family: var(--font); font-size: var(--f-base); color: var(--t-100);
      &::placeholder { color: var(--t-500); }
    }

    .pa__spinner {
      width: 14px; height: 14px; flex-shrink: 0;
      border: 2px solid var(--b-2); border-top-color: var(--c-accent);
      border-radius: 50%; animation: pa-spin .7s linear infinite;
    }
    @keyframes pa-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .pa__spinner { animation-duration: 2s; } }

    .pa__list {
      position: absolute; z-index: var(--z-3); top: calc(100% + var(--sp-3)); left: 0;
      width: min(360px, 88vw);
      max-height: 320px; overflow-y: auto;
      padding: var(--sp-2);
      list-style: none;
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-xl);
    }

    .pa__item {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--r-md);
      cursor: pointer;
      &.is-active { background: var(--c-accent-lo); }
    }
    .pa__item-icon { color: var(--dk-blue); flex-shrink: 0; }
    .pa__item-text {
      display: flex; flex-direction: column; min-width: 0;
      strong { font-size: var(--f-sm); font-weight: var(--w-6); color: var(--t-100); }
      em { font-size: var(--f-xs); font-style: normal; color: var(--t-400);
           white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
  `],
})
export class RsPlaceAutocompleteComponent implements ControlValueAccessor {
  private readonly geoService = inject(GeoService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly inputId = input('pa-ciudad');
  readonly placeholder = input('Ciudad, zona o dirección');

  /** Se emite al elegir una sugerencia, con las coordenadas ya resueltas. */
  readonly lugarElegido = output<LugarElegido>();
  /** Se emite al confirmar con Enter sin desplegable abierto. */
  readonly confirmado = output<void>();

  readonly texto = signal('');
  readonly sugerencias = signal<SugerenciaLugar[]>([]);
  readonly cargando = signal(false);
  readonly deshabilitado = signal(false);
  readonly indiceActivo = signal(-1);
  private readonly abierto = signal(false);

  readonly listaId = 'pa-lista';

  private readonly termino$ = new Subject<string>();
  private readonly destruido$ = new Subject<void>();

  private alCambiar: (valor: string) => void = () => {};
  private alTocar: () => void = () => {};

  constructor() {
    this.termino$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((t) => this.geoService.autocompletar(t)),
        takeUntil(this.destruido$),
      )
      .subscribe((lista) => {
        this.sugerencias.set(lista);
        this.indiceActivo.set(-1);
        this.cargando.set(false);
      });
  }

  hayLista(): boolean {
    return this.abierto() && this.sugerencias().length > 0;
  }

  activoId(): string | null {
    return this.indiceActivo() >= 0 ? `${this.listaId}-${this.indiceActivo()}` : null;
  }

  escribir(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.texto.set(valor);
    this.alCambiar(valor);
    this.abierto.set(true);

    // Desde el primer carácter, tal y como pidió el cliente (P6).
    if (!valor.trim()) {
      this.sugerencias.set([]);
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.termino$.next(valor.trim());
  }

  alEnfocar(): void {
    if (this.sugerencias().length) this.abierto.set(true);
  }

  alPerderFoco(): void {
    this.alTocar();
    // `mousedown` en la lista se dispara antes que el blur, así que elegir con
    // ratón sigue funcionando; esto solo cierra cuando el foco se va de verdad.
    this.abierto.set(false);
  }

  teclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.abierto.set(false);
      return;
    }

    if (!this.hayLista()) {
      if (evento.key === 'Enter') this.confirmado.emit();
      return;
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      const total = this.sugerencias().length;
      this.indiceActivo.set((this.indiceActivo() + paso + total) % total);
      return;
    }

    if (evento.key === 'Enter') {
      evento.preventDefault();
      const elegida = this.sugerencias()[this.indiceActivo()] ?? this.sugerencias()[0];
      if (elegida) this.elegir(elegida);
    }
  }

  async elegir(sugerencia: SugerenciaLugar): Promise<void> {
    this.texto.set(sugerencia.principal);
    this.alCambiar(sugerencia.principal);
    this.sugerencias.set([]);
    this.abierto.set(false);

    // Cierra la sesión de facturación de Places antes de pedir el detalle.
    this.geoService.cerrarSesion();

    const lugar = await this.geoService.coordenadas(sugerencia.placeId);
    // Pulsar la población lleva al resultado (P4), tenga o no coordenadas.
    this.lugarElegido.emit({
      placeId: sugerencia.placeId,
      ...(lugar ?? { ciudad: sugerencia.principal, lat: NaN, lng: NaN }),
    });
  }

  @HostListener('document:click', ['$event'])
  cerrarAlPulsarFuera(evento: MouseEvent): void {
    if (!this.host.nativeElement.contains(evento.target as Node)) this.abierto.set(false);
  }

  // ── ControlValueAccessor ──
  writeValue(valor: string | null): void {
    this.texto.set(valor ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }
}
