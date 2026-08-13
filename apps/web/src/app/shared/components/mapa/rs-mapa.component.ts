import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy,
  effect, input, output, viewChild,
} from '@angular/core';
import type { Map as LeafletMap, Marker } from 'leaflet';

/** Punto pintable en el mapa. `etiqueta` es lo que se ve en el pin (p. ej. "€24"). */
export interface PuntoMapa {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly etiqueta?: string;
  readonly titulo?: string;
  /** Miniatura de la tarjeta emergente al pulsar el pin. */
  readonly imagen?: string;
  /** Nota media, para la tarjeta emergente. 0 = todavía sin reseñas. */
  readonly rating?: number;
}

/** Rectángulo visible del mapa, en el mismo lenguaje que espera el API. */
export interface ZonaMapa {
  readonly swLat: number;
  readonly swLng: number;
  readonly neLat: number;
  readonly neLng: number;
  readonly centroLat: number;
  readonly centroLng: number;
  readonly zoom: number;
}

/** Centro por defecto (Madrid) cuando ningún punto trae coordenadas. */
const CENTRO_POR_DEFECTO: [number, number] = [40.4168, -3.7038];
const ZOOM_POR_DEFECTO = 11;
/** Zoom al centrar sobre un único resultado; `fitBounds` daría uno absurdo. */
const ZOOM_PUNTO_UNICO = 14;

/**
 * Espera antes de anunciar la zona visible. Arrastrar el mapa dispara `moveend`
 * en cada soltar del ratón; sin este margen, un paseo por la costa lanzaría una
 * búsqueda por cada tirón.
 */
const ESPERA_MOVIMIENTO_MS = 400;

/**
 * Mapa de puntos sobre OpenStreetMap (PDF 27/07 §3, captura WA0009).
 *
 * Compartido a propósito: lo consumen el listado de resultados (pines con
 * precio), el buscador por mapa estilo Booking y el módulo Comunidad/Explora.
 *
 * Leaflet se carga con `import()` dinámico y solo en el navegador: es una
 * librería que toca `window` al importarse, así que un import estático rompería
 * cualquier render en servidor y engordaría el bundle inicial de quien nunca
 * abre el mapa.
 */
@Component({
  selector: 'rs-mapa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="rs-mapa__lienzo" #lienzo role="application" [attr.aria-label]="ariaLabel()"></div>`,
  styles: [`
    :host { display: block; height: 100%; }
    .rs-mapa__lienzo { height: 100%; width: 100%; border-radius: inherit; }

    /* Pin con el precio, al estilo Booking. Se inyecta como divIcon, por eso
       necesita ::ng-deep: Leaflet lo cuelga fuera del árbol del componente. */
    :host ::ng-deep .rs-pin {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 9px;
      border-radius: var(--r-full);
      background: var(--c-card);
      border: 2px solid var(--c-accent);
      color: var(--dk-blue);
      font-family: var(--font);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0, 0, 0, .25);
      cursor: pointer;
      transition: background .15s, color .15s, transform .15s;
    }

    :host ::ng-deep .rs-pin:hover,
    :host ::ng-deep .rs-pin--activo {
      background: var(--dk-gold);
      border-color: var(--dk-gold);
      color: var(--dk-blue-deep, #00135D);
      transform: scale(1.08);
    }

    /* Tarjeta emergente del pin (mismo contenido mínimo que la de Booking). */
    :host ::ng-deep .rs-mapa-pop { width: 200px; font-family: var(--font); }
    :host ::ng-deep .rs-mapa-pop__img {
      width: 100%; height: 96px; object-fit: cover;
      border-radius: var(--r-md); margin-bottom: 6px;
    }
    :host ::ng-deep .rs-mapa-pop__titulo {
      display: block; font-size: 13px; font-weight: 700; color: var(--dk-blue);
      line-height: 1.3; margin-bottom: 2px;
    }
    :host ::ng-deep .rs-mapa-pop__meta { font-size: 12px; color: var(--t-400); }
    :host ::ng-deep .rs-mapa-pop__nota {
      display: inline-block; padding: 1px 5px; margin-right: 2px;
      border-radius: var(--r-sm) var(--r-sm) var(--r-sm) 0;
      background: var(--dk-blue); color: #fff;
      font-size: 11px; font-weight: 700;
    }
    :host ::ng-deep .rs-mapa-pop__precio { font-weight: 700; color: var(--t-100); }
  `],
})
export class RsMapaComponent implements AfterViewInit, OnDestroy {
  readonly puntos = input<PuntoMapa[]>([]);
  readonly ariaLabel = input('Mapa de resultados');
  /** Id del punto resaltado desde fuera (p. ej. la tarjeta con el ratón encima). */
  readonly activo = input<string | null>(null);

  /**
   * `false` deja el mapa quieto en la vista que le pidan. Se apaga cuando el
   * usuario navega él mismo: reencuadrar tras cada búsqueda le arrancaría el
   * mapa de debajo del ratón justo después de haberlo colocado.
   */
  readonly autoencuadre = input(true);

  /** Permite hacer zoom con la rueda; solo en el mapa a pantalla completa. */
  readonly zoomConRueda = input(false);

  /** Vista impuesta desde fuera (al elegir una población en el buscador). */
  readonly centro = input<{ lat: number; lng: number; zoom?: number } | null>(null);

  readonly puntoElegido = output<string>();
  /** Zona visible tras mover o hacer zoom; la dispara solo el usuario. */
  readonly zonaCambiada = output<ZonaMapa>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');

  private mapa: LeafletMap | null = null;
  private marcadores = new Map<string, Marker>();
  /** Módulo Leaflet ya cargado; null hasta que termina el import dinámico. */
  private L: typeof import('leaflet') | null = null;
  private temporizadorMovimiento: ReturnType<typeof setTimeout> | null = null;
  /**
   * Silencia `zonaCambiada` mientras el propio componente reencuadra. Sin esto,
   * ajustar la vista a los resultados pediría otra búsqueda, que reencuadraría
   * otra vez: el mapa entraría en un bucle de peticiones.
   */
  private reencuadrando = false;

  constructor() {
    // Repinta los pines cuando cambian los puntos o el resaltado, pero solo
    // después de que el mapa exista (el efecto se dispara antes del AfterViewInit).
    effect(() => {
      const puntos = this.puntos();
      const activo = this.activo();
      if (this.mapa) this.pintar(puntos, activo);
    });

    // Centrado imperativo desde el buscador de poblaciones del mapa.
    effect(() => {
      const centro = this.centro();
      if (centro && this.mapa) this.centrarEn(centro.lat, centro.lng, centro.zoom);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    this.L = await import('leaflet');
    // El componente puede haberse destruido mientras se cargaba Leaflet; montar
    // el mapa sobre un elemento ya desconectado deja un observer huérfano.
    if (!this.lienzo().nativeElement.isConnected) return;

    this.mapa = this.L.map(this.lienzo().nativeElement, {
      center: CENTRO_POR_DEFECTO,
      zoom: ZOOM_POR_DEFECTO,
      // El scroll de la página no debe secuestrarse al pasar sobre el mapa,
      // salvo cuando el mapa ocupa la pantalla y es lo que se está usando.
      scrollWheelZoom: this.zoomConRueda(),
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; colaboradores de OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.mapa);

    this.mapa.on('moveend', () => this.anunciarZona());

    const centro = this.centro();
    if (centro) this.centrarEn(centro.lat, centro.lng, centro.zoom);

    this.pintar(this.puntos(), this.activo());
  }

  ngOnDestroy(): void {
    if (this.temporizadorMovimiento) clearTimeout(this.temporizadorMovimiento);
    this.mapa?.remove();
    this.mapa = null;
  }

  /** Redibuja el mapa tras un cambio de tamaño del contenedor (abrir/cerrar la vista). */
  refrescar(): void {
    this.mapa?.invalidateSize();
  }

  /** Lleva el mapa a una posición concreta sin emitir la zona como si fuese del usuario. */
  centrarEn(lat: number, lng: number, zoom = ZOOM_PUNTO_UNICO): void {
    if (!this.mapa || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.mapa.setView([lat, lng], zoom);
  }

  /** Zona visible actual; útil para la primera búsqueda al abrir el mapa. */
  zonaActual(): ZonaMapa | null {
    return this.mapa ? this.leerZona() : null;
  }

  private anunciarZona(): void {
    if (!this.mapa || this.reencuadrando) return;
    if (this.temporizadorMovimiento) clearTimeout(this.temporizadorMovimiento);
    this.temporizadorMovimiento = setTimeout(() => {
      const zona = this.leerZona();
      if (zona) this.zonaCambiada.emit(zona);
    }, ESPERA_MOVIMIENTO_MS);
  }

  private leerZona(): ZonaMapa | null {
    if (!this.mapa) return null;
    const limites = this.mapa.getBounds();
    const centro = this.mapa.getCenter();
    return {
      swLat: limites.getSouth(),
      swLng: limites.getWest(),
      neLat: limites.getNorth(),
      neLng: limites.getEast(),
      centroLat: centro.lat,
      centroLng: centro.lng,
      zoom: this.mapa.getZoom(),
    };
  }

  private pintar(puntos: PuntoMapa[], activo: string | null): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;

    this.marcadores.forEach((m) => m.remove());
    this.marcadores.clear();

    const conCoordenadas = puntos.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (conCoordenadas.length === 0) return;

    for (const punto of conCoordenadas) {
      const esActivo = punto.id === activo;
      const icono = L.divIcon({
        className: '',
        html: `<span class="rs-pin${esActivo ? ' rs-pin--activo' : ''}">${punto.etiqueta ?? '•'}</span>`,
        iconSize: undefined,
      });

      const marcador = L.marker([punto.lat, punto.lng], { icon: icono, title: punto.titulo })
        .addTo(mapa)
        .on('click', () => this.puntoElegido.emit(punto.id));

      const tarjeta = this.tarjetaEmergente(punto);
      if (tarjeta) marcador.bindPopup(tarjeta, { closeButton: true, offset: [0, -6] });

      this.marcadores.set(punto.id, marcador);
    }

    if (this.autoencuadre()) this.encuadrar(conCoordenadas);
  }

  /**
   * Contenido de la tarjeta emergente. Se compone a mano porque Leaflet solo
   * acepta HTML plano en los popups; los datos vienen del API, y los textos van
   * escapados para que un título con comillas no rompa el marcado.
   */
  private tarjetaEmergente(punto: PuntoMapa): string | null {
    if (!punto.titulo) return null;

    const titulo = this.escapar(punto.titulo);
    const imagen = punto.imagen
      ? `<img class="rs-mapa-pop__img" src="${this.escapar(punto.imagen)}" alt="" loading="lazy">`
      : '';
    // La nota va en una insignia con su número, como el marcador de puntuación
    // de Booking: el proyecto no admite emojis en el código de producción.
    const nota = punto.rating
      ? `<span class="rs-mapa-pop__nota" title="Valoración">${punto.rating.toFixed(1)}</span> `
      : '';
    const precio = punto.etiqueta
      ? `<span class="rs-mapa-pop__precio">${this.escapar(punto.etiqueta)}</span>`
      : '';

    return `<div class="rs-mapa-pop">${imagen}`
      + `<span class="rs-mapa-pop__titulo">${titulo}</span>`
      + `<span class="rs-mapa-pop__meta">${nota}${precio}</span></div>`;
  }

  private escapar(texto: string): string {
    return texto
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Encaja la vista a todos los puntos. Se marca como movimiento propio para
   * que no se confunda con una navegación del usuario y dispare otra búsqueda.
   */
  private encuadrar(puntos: PuntoMapa[]): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;

    this.reencuadrando = true;
    try {
      if (puntos.length === 1) {
        mapa.setView([puntos[0].lat, puntos[0].lng], ZOOM_PUNTO_UNICO);
      } else {
        mapa.fitBounds(
          L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [40, 40] },
        );
      }
    } finally {
      // `moveend` llega en el mismo tick que `fitBounds`; liberar la bandera en
      // una macrotarea garantiza que ya ha pasado.
      setTimeout(() => { this.reencuadrando = false; }, 0);
    }
  }
}
