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
           posicionZoom="bottomright"
           [centro]="centro()"
           [ariaLabel]="ariaLabel()"
           (puntoElegido)="puntoElegido.emit($event)"
           (zonaCambiada)="alMoverMapa($event)" />

  <!-- Caja "Buscar en el mapa" y su estado, apilados: al ir en el mismo
       contenedor, el recuento se coloca solo debajo del buscador y no hay que
       adivinar su altura desde el CSS. -->
  <div class="mb__panel">
    <div class="mb__buscar">
      <rs-place-autocomplete
        inputId="mapa-buscar"
        placeholder="Buscar en el mapa"
        (lugarElegido)="irALugar($event)" />
    </div>

    <p class="mb__estado" role="status">
      @if (cargando()) {
        Buscando en esta zona…
      } @else {
        {{ resumen() }}
      }
    </p>
  </div>

  <button type="button" class="mb__cerrar" (click)="cerrar.emit()"
          aria-label="Cerrar el mapa y volver a la lista">
    <span class="mb__cerrar-txt">Cerrar el mapa</span>
    <rs-icon name="x" [size]="18" [stroke]="2" />
  </button>

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

    /* Los mandos se reordenan según el ancho del mapa, no el de la ventana: en
       la vista dividida el mapa ocupa media pantalla, así que en un portátil
       tiene el mismo ancho que en una tableta y necesita el mismo reparto. */
    .mb { position: relative; height: 100%; container-type: inline-size; }
    .mb__lienzo { height: 100%; }

    /* Los controles flotan sobre el lienzo. Van por encima de 1000, que es
       donde Leaflet cuelga sus propios controles: con menos, el zoom se
       dibujaría encima de la caja de búsqueda. */
    .mb__panel,
    .mb__cerrar,
    .mb__zona { position: absolute; z-index: 1100; }

    .mb__panel {
      top: var(--sp-4);
      left: 50%;
      transform: translateX(-50%);
      width: min(420px, calc(100% - var(--sp-8)));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
    }

    .mb__buscar {
      width: 100%;
      padding: var(--sp-2) var(--sp-4);
      background: var(--c-card);
      border: 2px solid var(--dk-gold);
      border-radius: var(--r-lg);
      box-shadow: var(--sh-lg);
    }

    .mb__cerrar {
      top: var(--sp-4);
      right: var(--sp-4);
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
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
      /* Por encima de la línea de atribución de OpenStreetMap y sin invadir
         las esquinas, donde Leaflet clava el zoom y la propia atribución. */
      bottom: calc(var(--sp-4) + 22px);
      left: 50%;
      transform: translateX(-50%);
      max-width: calc(100% - 120px);
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

    .mb__estado {
      max-width: 100%;
      padding: var(--sp-1) var(--sp-4);
      background: var(--c-card);
      border-radius: var(--r-full);
      box-shadow: var(--sh-md);
      color: var(--t-300);
      font-size: var(--f-xs);
      text-align: center;
    }

    /* Mapa estrecho (móvil, o la vista dividida en un portátil): la barra
       superior pasa a ser buscador + botón redondo de cerrar. El texto del
       botón desaparece porque, con él, la caja de búsqueda se quedaba en poco
       más de un centímetro en una pantalla de 360px. */
    @container (max-width: 720px) {
      .mb__panel {
        top: var(--sp-3);
        left: var(--sp-3);
        /* Hueco a la derecha para el botón redondo de cerrar. */
        right: calc(var(--sp-3) + 52px);
        width: auto;
        transform: none;
        align-items: stretch;
      }

      .mb__buscar { padding: var(--sp-1) var(--sp-3); }

      .mb__cerrar {
        top: var(--sp-3);
        right: var(--sp-3);
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border-radius: var(--r-full);
      }

      .mb__cerrar-txt {
        position: absolute;
        width: 1px; height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }

      .mb__estado {
        border-radius: var(--r-lg);
        text-align: start;
      }

      /* Alineada a la izquierda, con hueco a la derecha para el zoom y por
         encima de la línea de atribución de OpenStreetMap, que Leaflet clava
         en la esquina inferior derecha. */
      .mb__zona {
        left: var(--sp-3);
        right: calc(var(--sp-3) + 48px);
        bottom: calc(var(--sp-3) + 22px);
        max-width: none;
        transform: none;
        gap: var(--sp-2);
        justify-content: flex-start;
      }

      .mb__auto, .mb__rebuscar { padding-block: var(--sp-2); }
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
