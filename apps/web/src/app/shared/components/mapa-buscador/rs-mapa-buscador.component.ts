import {
  ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild,
} from '@angular/core';
import { RsIconComponent } from '../icon/rs-icon.component';
import {
  RsPlaceAutocompleteComponent, type LugarElegido,
} from '../place-autocomplete/rs-place-autocomplete.component';
import { RsMapaComponent, type PuntoMapa, type ZonaMapa } from '../mapa/rs-mapa.component';

/**
 * Buscador por mapa al estilo Booking: el mapa ocupa la pantalla, con la caja
 * "Buscar en el mapa" arriba, el botón de cerrar y la re-búsqueda por zona.
 *
 * Es presentacional a propósito: no sabe qué se busca ni cómo. Quien lo usa
 * (cada listado de vertical) recibe la zona y decide qué pedir al API, de modo
 * que el mismo panel sirve para alojamiento, veterinaria o peluquería.
 */
@Component({
  selector: 'rs-mapa-buscador',
  standalone: true,
  imports: [RsIconComponent, RsPlaceAutocompleteComponent, RsMapaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="mb">
  <rs-mapa #mapa class="mb__lienzo"
           [puntos]="puntos()"
           [activo]="activo()"
           [autoencuadre]="autoencuadre()"
           [zoomConRueda]="true"
           [centro]="centro()"
           [ariaLabel]="ariaLabel()"
           (puntoElegido)="puntoElegido.emit($event)"
           (zonaCambiada)="alMoverMapa($event)" />

  <!-- Buscador, cierre y estado en una sola rejilla: repartirse el ancho entre
       ellos es lo que evita que en móvil se pisen o se salgan de la pantalla. -->
  <div class="mb__superior">
    <!-- Caja "Buscar en el mapa": recentra sin tocar el resto de filtros -->
    <div class="mb__buscar">
      <rs-place-autocomplete
        inputId="mapa-buscar"
        placeholder="Buscar en el mapa"
        (lugarElegido)="irALugar($event)" />
    </div>

    <button type="button" class="mb__cerrar" aria-label="Cerrar el mapa" (click)="cerrar.emit()">
      <span class="mb__cerrar-txt">Cerrar el mapa</span>
      <rs-icon name="x" [size]="18" [stroke]="2" />
    </button>

    <p class="mb__estado" role="status">
      @if (cargando()) {
        Buscando en esta zona…
      } @else {
        {{ resumen() }}
      }
    </p>
  </div>

  <!-- Controles de zona: réplica del "Buscar mientras me desplazo" de Booking -->
  <div class="mb__zona">
    <label class="mb__auto">
      <input type="checkbox" [checked]="buscarAlMover()" (change)="alternarAuto()" />
      Buscar al mover el mapa
    </label>

    @if (!buscarAlMover() && zonaPendiente()) {
      <button type="button" class="mb__rebuscar" (click)="buscarEnEstaZona()">
        <rs-icon name="search" [size]="15" [stroke]="2" />
        Buscar en esta zona
      </button>
    }
  </div>
</div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .mb { position: relative; height: 100%; }
    .mb__lienzo { height: 100%; }

    /* Los controles flotan sobre el lienzo; por encima del panel del proveedor
       del mapa (Leaflet usa z-index 400) o quedarían tapados por las teselas. */
    .mb__superior,
    .mb__zona {
      position: absolute;
      z-index: 500;
      /* Las dos barras cruzan el mapa de lado a lado; sin esto sus huecos
         vacíos se comerían el arrastre justo en las franjas superior e
         inferior, que en móvil son media pantalla. */
      pointer-events: none;
    }

    .mb__buscar,
    .mb__cerrar,
    .mb__estado,
    .mb__auto,
    .mb__rebuscar { pointer-events: auto; }

    /* La caja de búsqueda se queda con el ancho sobrante y el cierre ocupa lo
       que necesite. Con anchos fijos se solapaban en cuanto el mapa compartía
       pantalla con la lista, que es el caso normal en escritorio. */
    .mb__superior {
      top: var(--sp-4);
      left: var(--sp-4);
      right: var(--sp-4);
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: var(--sp-3);
    }

    .mb__buscar {
      grid-column: 1;
      max-width: 420px;
      padding: var(--sp-2) var(--sp-4);
      background: var(--c-card);
      border: 2px solid var(--dk-gold);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-lg);
    }

    .mb__cerrar {
      grid-column: 2;
      justify-self: end;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-2);
      min-height: 44px;
      /* Sin esto, en la columna estrecha del mapa el texto se parte en tres
         líneas y el botón crece hasta tapar la caja de búsqueda. */
      white-space: nowrap;
      padding: var(--sp-3) var(--sp-4);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-lg);
      color: var(--t-100);
      font-family: var(--font);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      cursor: pointer;

      &:hover { background: var(--c-raised); }
    }

    .mb__zona {
      /* En móvil la barra del navegador se come la franja inferior: el área
         segura levanta los controles justo lo necesario para poder pulsarlos. */
      bottom: max(var(--sp-4), env(safe-area-inset-bottom, 0px));
      left: var(--sp-4);
      right: var(--sp-4);
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      flex-wrap: wrap;
      justify-content: center;
    }

    .mb__auto {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      min-height: 44px;
      padding: var(--sp-2) var(--sp-4);
      background: var(--c-card);
      border: 1px solid var(--b-1);
      border-radius: var(--r-full);
      box-shadow: var(--sh-md);
      color: var(--t-200);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      cursor: pointer;
    }

    .mb__rebuscar {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      min-height: 44px;
      padding: var(--sp-2) var(--sp-5);
      background: var(--c-accent);
      border: none;
      border-radius: var(--r-full);
      box-shadow: var(--sh-md);
      color: #fff;
      font-family: var(--font);
      font-size: var(--f-sm);
      font-weight: var(--w-6);
      cursor: pointer;

      &:hover { background: var(--c-accent-h); }
    }

    /* Va bajo la caja de búsqueda, dentro de la rejilla: colocarlo con un
       desplazamiento fijo lo dejaba encima del buscador en cuanto el texto
       ocupaba dos líneas. */
    .mb__estado {
      grid-column: 1;
      justify-self: start;
      max-width: 100%;
      padding: var(--sp-1) var(--sp-4);
      background: var(--c-card);
      border-radius: var(--r-full);
      box-shadow: var(--sh-md);
      color: var(--t-300);
      font-size: var(--f-xs);
      text-align: center;
    }

    /* Móvil: la caja de búsqueda se queda con el ancho sobrante y el cierre
       encoge a icono, que a 320px es lo único que cabe junto a ella. */
    @media (max-width: 640px) {
      .mb__superior { gap: var(--sp-2); }
      .mb__buscar { padding: var(--sp-1) var(--sp-3); }
      .mb__cerrar { min-width: 44px; padding: var(--sp-2); }
      .mb__estado { grid-column: 1 / -1; }
      .mb__cerrar-txt { display: none; }
      .mb__auto, .mb__rebuscar { font-size: var(--f-xs); }
    }
  `],
})
export class RsMapaBuscadorComponent {
  readonly puntos = input<PuntoMapa[]>([]);
  readonly activo = input<string | null>(null);
  readonly cargando = input(false);
  readonly ariaLabel = input('Mapa de resultados de la búsqueda');
  /**
   * Cuántos resultados hay en total, que no tiene por qué coincidir con los
   * pines: un servicio sin coordenadas cuenta en la lista y no en el mapa.
   */
  readonly total = input<number | null>(null);

  readonly cerrar = output<void>();
  readonly puntoElegido = output<string>();
  /** Zona por la que hay que volver a buscar (auto al mover, o al pulsar el botón). */
  readonly zonaBuscada = output<ZonaMapa>();

  private readonly mapa = viewChild<RsMapaComponent>('mapa');

  readonly buscarAlMover = signal(true);
  /** Vista impuesta al elegir una población en la caja "Buscar en el mapa". */
  readonly centro = signal<{ lat: number; lng: number; zoom?: number } | null>(null);
  /** Última zona vista pero todavía no buscada (modo manual). */
  readonly zonaPendiente = signal<ZonaMapa | null>(null);

  /**
   * El mapa deja de reencuadrarse solo en cuanto el usuario lo mueve: a partir
   * de ahí la vista es suya, y recolocarla en cada búsqueda sería pelearse con
   * él. Antes de eso sí conviene, para que la primera carga muestre algo.
   */
  readonly autoencuadre = signal(true);

  readonly resumen = computed(() => {
    const total = this.total();
    const pines = this.puntos().length;
    if (total === null) return `${pines} ${pines === 1 ? 'resultado' : 'resultados'} en el mapa`;
    if (total === 0) return 'Sin resultados en esta zona';

    const sinUbicacion = total - pines;
    const base = `${total} ${total === 1 ? 'resultado' : 'resultados'}`;
    return sinUbicacion > 0
      ? `${base} · ${sinUbicacion} sin ubicación exacta`
      : base;
  });

  /** Recalcula el tamaño del lienzo; se llama al abrir el panel desde fuera. */
  refrescar(): void {
    this.mapa()?.refrescar();
  }

  alMoverMapa(zona: ZonaMapa): void {
    this.autoencuadre.set(false);
    if (this.buscarAlMover()) {
      this.zonaPendiente.set(null);
      this.zonaBuscada.emit(zona);
      return;
    }
    this.zonaPendiente.set(zona);
  }

  alternarAuto(): void {
    const activado = !this.buscarAlMover();
    this.buscarAlMover.set(activado);
    // Al reactivarlo, la zona que se estaba mirando se busca ya: dejarla en
    // espera obligaría a mover el mapa un pixel para que reaccionase.
    if (activado) this.buscarEnEstaZona();
  }

  buscarEnEstaZona(): void {
    const zona = this.zonaPendiente() ?? this.mapa()?.zonaActual();
    if (!zona) return;
    this.zonaPendiente.set(null);
    this.zonaBuscada.emit(zona);
  }

  /**
   * Población elegida en la caja del mapa. El catálogo local no trae
   * coordenadas (`NaN`), así que ahí no hay a dónde centrar: se ignora en vez
   * de mandar el mapa al punto (0,0), en mitad del Atlántico.
   */
  irALugar(lugar: LugarElegido): void {
    if (!Number.isFinite(lugar.lat) || !Number.isFinite(lugar.lng)) return;
    this.autoencuadre.set(false);
    this.centro.set({ lat: lugar.lat, lng: lugar.lng, zoom: 13 });
  }
}
