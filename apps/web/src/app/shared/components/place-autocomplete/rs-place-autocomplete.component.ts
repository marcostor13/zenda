import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, forwardRef, inject, input, output, signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';
import {
  CoordenadasLugar, DireccionLugar, GeoService, SugerenciaLugar, TipoLugar,
} from '../../../core/geo/geo.service';
import { CIUDADES_ES } from '../../catalogos/lugares.catalogo';
import { RsIconComponent } from '../icon/rs-icon.component';

/**
 * Población elegida por el usuario. Incluye el `placeId` porque quien la recibe
 * puede necesitarlo después (por ejemplo, para calcular un trayecto) sin volver
 * a resolver la búsqueda.
 */
export interface LugarElegido extends CoordenadasLugar {
  placeId: string;
  /** Sólo con `tipo="direccion"`: la dirección postal ya desmenuzada. */
  direccion?: DireccionLugar;
}

/** Marca las sugerencias que salen del catálogo local, sin `placeId` real. */
const ORIGEN_LOCAL = 'local:';

/** Compara ignorando mayúsculas y tildes: "Cadiz" encuentra "Cádiz". */
const normalizar = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Campo de población: **siempre un selector con buscador**, nunca un texto libre
 * a ciegas. Sugiere desde la primera letra (P6) y también al enfocar sin escribir.
 *
 * Dos fuentes que se complementan:
 * - **Catálogo local** de poblaciones españolas, que funciona siempre.
 * - **Google Places**, que afina y aporta coordenadas cuando hay clave.
 *
 * Sin clave de Places el campo sigue siendo un selector real con el catálogo; el
 * antiguo comportamiento (lista vacía y a escribir a mano) dejaba al usuario sin
 * ninguna ayuda justo en el campo que decide los resultados de la búsqueda.
 *
 * Se sigue admitiendo escribir una población que no esté en ninguna de las dos
 * fuentes: en España hay más de 8.000 municipios y bloquear el campo impediría
 * dar de alta un comercio en un pueblo pequeño.
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
  <div class="pa__ctrl" [class.is-campo]="apariencia() === 'campo'">
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

    /* Dentro de un formulario adopta el aspecto de un .rs-inp normal. */
    .pa__ctrl.is-campo {
      min-height: 44px; padding: var(--sp-2) var(--sp-3);
      background: var(--c-card);
      border: 1px solid var(--b-2); border-radius: var(--r-lg);
      transition: border-color var(--d-2), box-shadow var(--d-2);

      &:focus-within { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-lo); }
    }

    .pa__inp {
      flex: 1; min-width: 0;
      border: none; outline: none; background: transparent;
      padding-block: 2px;
      /* En móvil sube a 16px y gana alto: ver §30 de styles.scss. */
      @media (max-width: 768px) { font-size: var(--f-md); padding-block: var(--sp-2); }
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
  /** `campo` lo enmarca como un `.rs-inp`; `plana` lo deja embebido (buscador). */
  readonly apariencia = input<'plana' | 'campo'>('plana');
  /**
   * `ciudad` sugiere poblaciones; `direccion` sugiere portales con calle y
   * número y emite la dirección postal completa al elegir uno.
   */
  readonly tipo = input<TipoLugar>('ciudad');
  /** Lista local que siempre está disponible; por defecto, poblaciones españolas. */
  readonly catalogoLocal = input<readonly string[]>(CIUDADES_ES);
  /** `false` en listas cerradas (provincias): no tiene sentido consultar Places. */
  readonly usaPlaces = input(true);
  /** Cuántas sugerencias locales mostrar al enfocar sin haber escrito nada. */
  readonly sugerenciasIniciales = input(8);

  /** Se emite al elegir una sugerencia, con las coordenadas ya resueltas. */
  readonly lugarElegido = output<LugarElegido>();
  /** Se emite al confirmar con Enter sin desplegable abierto. */
  readonly confirmado = output<void>();

  readonly texto = signal('');
  /** Sugerencias devueltas por Places; se funden con las del catálogo local. */
  private readonly remotas = signal<SugerenciaLugar[]>([]);
  readonly cargando = signal(false);
  readonly deshabilitado = signal(false);
  readonly indiceActivo = signal(-1);
  private readonly abierto = signal(false);

  readonly listaId = 'pa-lista';

  /**
   * Poblaciones del catálogo que casan con lo escrito (o las primeras). Buscando
   * direcciones no hay catálogo que valga: no existe una lista local de portales.
   */
  private readonly locales = computed<SugerenciaLugar[]>(() => {
    if (this.tipo() === 'direccion') return [];

    const filtro = normalizar(this.texto());
    const casan = filtro
      ? this.catalogoLocal().filter((c) => normalizar(c).includes(filtro))
      : this.catalogoLocal().slice(0, this.sugerenciasIniciales());

    // Las que empiezan por lo escrito van primero: es lo que se está buscando.
    const ordenadas = filtro
      ? [...casan].sort((a, b) =>
          Number(normalizar(b).startsWith(filtro)) - Number(normalizar(a).startsWith(filtro)))
      : casan;

    return ordenadas.slice(0, 8).map((nombre) => ({
      placeId: `${ORIGEN_LOCAL}${nombre}`,
      descripcion: nombre,
      principal: nombre,
      secundario: '',
    }));
  });

  /** Catálogo local primero (instantáneo) y debajo lo que aporte Places. */
  readonly sugerencias = computed<SugerenciaLugar[]>(() => {
    const locales = this.locales();
    const yaEstan = new Set(locales.map((s) => normalizar(s.principal)));
    const remotas = this.remotas().filter((s) => !yaEstan.has(normalizar(s.principal)));
    return [...locales, ...remotas].slice(0, 12);
  });

  private readonly termino$ = new Subject<string>();
  private readonly destruido$ = new Subject<void>();

  private alCambiar: (valor: string) => void = () => {};
  private alTocar: () => void = () => {};

  constructor() {
    this.termino$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((t) => this.geoService.autocompletar(t, this.tipo())),
        takeUntil(this.destruido$),
      )
      .subscribe((lista) => {
        this.remotas.set(lista);
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
    if (!valor.trim() || !this.usaPlaces()) {
      this.remotas.set([]);
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.termino$.next(valor.trim());
  }

  /** Al enfocar siempre se despliega: el catálogo local nunca está vacío. */
  alEnfocar(): void {
    this.abierto.set(true);
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
    this.remotas.set([]);
    this.abierto.set(false);

    // Las del catálogo local no tienen `placeId` real: no hay detalle que pedir
    // ni sesión de Places que cerrar, así que se resuelven sin salir a la red.
    if (sugerencia.placeId.startsWith(ORIGEN_LOCAL)) {
      this.lugarElegido.emit({ placeId: '', ciudad: sugerencia.principal, lat: NaN, lng: NaN });
      return;
    }

    // Cierra la sesión de facturación de Places antes de pedir el detalle.
    this.geoService.cerrarSesion();

    if (this.tipo() === 'direccion') {
      await this.emitirDireccion(sugerencia);
      return;
    }

    const lugar = await this.geoService.coordenadas(sugerencia.placeId);
    // Pulsar la población lleva al resultado (P4), tenga o no coordenadas.
    this.lugarElegido.emit({
      placeId: sugerencia.placeId,
      ...(lugar ?? { ciudad: sugerencia.principal, lat: NaN, lng: NaN }),
    });
  }

  /**
   * Emite el portal elegido con su dirección desmenuzada. Si el detalle no llega
   * se emite igual con lo que ya se sabe: el comercio conserva lo tecleado y
   * puede completar el resto a mano, en vez de perder la selección.
   */
  private async emitirDireccion(sugerencia: SugerenciaLugar): Promise<void> {
    const direccion = await this.geoService.direccion(sugerencia.placeId);
    if (!direccion) {
      this.lugarElegido.emit({ placeId: sugerencia.placeId, ciudad: '', lat: NaN, lng: NaN });
      return;
    }

    // La calle con su número es lo que el usuario espera ver en el campo.
    const rotulo = [direccion.calle, direccion.numero].filter(Boolean).join(' ');
    if (rotulo) {
      this.texto.set(rotulo);
      this.alCambiar(rotulo);
    }

    this.lugarElegido.emit({
      placeId: sugerencia.placeId,
      ciudad: direccion.ciudad,
      lat: direccion.lat,
      lng: direccion.lng,
      direccion,
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
