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
}

/** Centro por defecto (Madrid) cuando ningún punto trae coordenadas. */
const CENTRO_POR_DEFECTO: [number, number] = [40.4168, -3.7038];
const ZOOM_POR_DEFECTO = 11;

/**
 * Mapa de puntos sobre OpenStreetMap (PDF 27/07 §3, captura WA0009).
 *
 * Compartido a propósito: lo consumen el listado de resultados (pines con
 * precio) y el módulo Comunidad/Explora, que también tenía el mapa pendiente
 * desde `ANALISIS-ESPECIFICACIONES.md` §4.2.
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
  `],
})
export class RsMapaComponent implements AfterViewInit, OnDestroy {
  readonly puntos = input<PuntoMapa[]>([]);
  readonly ariaLabel = input('Mapa de resultados');
  /** Id del punto resaltado desde fuera (p. ej. la tarjeta con el ratón encima). */
  readonly activo = input<string | null>(null);

  readonly puntoElegido = output<string>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');

  private mapa: LeafletMap | null = null;
  private marcadores = new Map<string, Marker>();
  /** Módulo Leaflet ya cargado; null hasta que termina el import dinámico. */
  private L: typeof import('leaflet') | null = null;

  constructor() {
    // Repinta los pines cuando cambian los puntos o el resaltado, pero solo
    // después de que el mapa exista (el efecto se dispara antes del AfterViewInit).
    effect(() => {
      const puntos = this.puntos();
      const activo = this.activo();
      if (this.mapa) this.pintar(puntos, activo);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    this.L = await import('leaflet');

    this.mapa = this.L.map(this.lienzo().nativeElement, {
      center: CENTRO_POR_DEFECTO,
      zoom: ZOOM_POR_DEFECTO,
      // El scroll de la página no debe secuestrarse al pasar sobre el mapa.
      scrollWheelZoom: false,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; colaboradores de OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.mapa);

    this.pintar(this.puntos(), this.activo());
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
    this.mapa = null;
  }

  /** Redibuja el mapa tras un cambio de tamaño del contenedor (abrir/cerrar la vista). */
  refrescar(): void {
    this.mapa?.invalidateSize();
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

      this.marcadores.set(punto.id, marcador);
    }

    // Encajar la vista a todos los puntos; con uno solo, `fitBounds` daría un
    // zoom máximo absurdo, así que ahí se centra manualmente.
    if (conCoordenadas.length === 1) {
      mapa.setView([conCoordenadas[0].lat, conCoordenadas[0].lng], 14);
    } else {
      mapa.fitBounds(
        L.latLngBounds(conCoordenadas.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 40] },
      );
    }
  }
}
