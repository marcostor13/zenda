import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy,
  effect, inject, input, output, viewChild,
} from '@angular/core';
import { GeoService } from '../../../core/geo/geo.service';
import { crearMotorGoogle } from './motores/motor-google';
import { crearMotorLeaflet } from './motores/motor-leaflet';
import {
  CENTRO_POR_DEFECTO, MotorMapa, OpcionesMotor, PuntoMapa, ZOOM_POR_DEFECTO, ZOOM_PUNTO_UNICO,
  ZonaMapa, puntosGeolocalizados,
} from './motores/motor-mapa';

export type { PuntoMapa, ZonaMapa } from './motores/motor-mapa';

/**
 * Espera antes de anunciar la zona visible. Arrastrar el mapa dispara un aviso
 * en cada soltar del ratón; sin este margen, un paseo por la costa lanzaría una
 * búsqueda por cada tirón.
 */
const ESPERA_MOVIMIENTO_MS = 400;

/**
 * Mapa de puntos (PDF 27/07 §3, captura WA0009).
 *
 * Compartido a propósito: lo consumen el listado de resultados (pines con
 * precio), el buscador por mapa estilo Booking y el módulo Comunidad/Explora.
 *
 * **Se pinta con Google Maps** cuando el API expone una clave de navegador
 * (`GET /geo/config`), que es la cartografía que pide el cliente y la misma que
 * ya alimenta el buscador de poblaciones. Si no hay clave, o si su SDK no llega
 * a cargarse, cae a OpenStreetMap: el buscador por mapa no puede depender de
 * que un proveedor externo esté disponible.
 */
@Component({
  selector: 'rs-mapa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="rs-mapa__lienzo" #lienzo role="application" [attr.aria-label]="ariaLabel()"></div>`,
  styles: [`
    :host { display: block; height: 100%; }
    .rs-mapa__lienzo { height: 100%; width: 100%; border-radius: inherit; }

    /* Los pines viven fuera del árbol del componente (los cuelga el proveedor
       del mapa), así que su estilo necesita ::ng-deep. */

    /* Capa que el motor coloca en la coordenada exacta. Va a tamaño cero y el
       centrado lo hace el pin de dentro: Leaflet posiciona sus marcadores con
       un transform propio sobre esta misma capa, así que ponerle aquí otro la
       amontonaría toda en el origen del mapa. */
    :host ::ng-deep .rs-pin-capa {
      position: absolute;
      width: 0;
      height: 0;
    }

    /* Pin con el precio, al estilo Booking. Se centra sobre la coordenada en
       lugar de colgar de ella por la esquina superior izquierda. */
    :host ::ng-deep .rs-pin {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      /* Alto mínimo de objetivo táctil: por debajo de esto, en móvil se falla
         el pin y se acaba arrastrando el mapa. */
      min-height: 32px;
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
    :host ::ng-deep .rs-pin:focus-visible,
    :host ::ng-deep .rs-pin--activo {
      background: var(--dk-gold);
      border-color: var(--dk-gold);
      color: var(--dk-blue-deep, #00135D);
      /* El centrado va en el mismo transform: si se sustituye por el escalado
         a secas, el pin salta de sitio al pasarle el ratón por encima. */
      transform: translate(-50%, -50%) scale(1.08);
    }

    @media (prefers-reduced-motion: reduce) {
      :host ::ng-deep .rs-pin { transition: none; }
      :host ::ng-deep .rs-pin:hover,
      :host ::ng-deep .rs-pin:focus-visible,
      :host ::ng-deep .rs-pin--activo { transform: translate(-50%, -50%); }
    }

    /* Tarjeta emergente del pin (mismo contenido mínimo que la de Booking). */
    :host ::ng-deep .rs-mapa-pop { width: min(200px, 60vw); font-family: var(--font); }
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
  private readonly geoService = inject(GeoService);

  private motor: MotorMapa | null = null;
  private temporizadorMovimiento: ReturnType<typeof setTimeout> | null = null;
  /**
   * Silencia `zonaCambiada` mientras el propio componente reencuadra. Sin esto,
   * ajustar la vista a los resultados pediría otra búsqueda, que reencuadraría
   * otra vez: el mapa entraría en un bucle de peticiones.
   */
  private reencuadrando = false;
  /** El componente puede morir mientras se carga el SDK del proveedor. */
  private destruido = false;

  constructor() {
    // Repinta los pines cuando cambian los puntos o el resaltado, pero solo
    // después de que el mapa exista (el efecto se dispara antes del AfterViewInit).
    effect(() => {
      const puntos = this.puntos();
      const activo = this.activo();
      if (this.motor) this.pintar(puntos, activo);
    });

    // Centrado imperativo desde el buscador de poblaciones del mapa.
    effect(() => {
      const centro = this.centro();
      if (centro && this.motor) this.centrarEn(centro.lat, centro.lng, centro.zoom);
    });
  }

  async ngAfterViewInit(): Promise<void> {
    const motor = await this.crearMotor();
    // El componente puede haberse destruido mientras cargaba el SDK; montar el
    // mapa sobre un elemento ya desconectado deja un observer huérfano.
    if (!motor) return;
    if (this.destruido || !this.lienzo().nativeElement.isConnected) {
      motor.destruir();
      return;
    }

    this.motor = motor;

    const centro = this.centro();
    if (centro) this.centrarEn(centro.lat, centro.lng, centro.zoom);

    this.pintar(this.puntos(), this.activo());
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.temporizadorMovimiento) clearTimeout(this.temporizadorMovimiento);
    this.motor?.destruir();
    this.motor = null;
  }

  /** Redibuja el mapa tras un cambio de tamaño del contenedor (abrir/cerrar la vista). */
  refrescar(): void {
    this.motor?.refrescar();
  }

  /** Lleva el mapa a una posición concreta sin emitir la zona como si fuese del usuario. */
  centrarEn(lat: number, lng: number, zoom = ZOOM_PUNTO_UNICO): void {
    if (!this.motor || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.motor.centrarEn(lat, lng, zoom);
  }

  /** Zona visible actual; útil para la primera búsqueda al abrir el mapa. */
  zonaActual(): ZonaMapa | null {
    return this.motor?.zonaActual() ?? null;
  }

  /**
   * Google Maps si el API da una clave de navegador; OpenStreetMap si no la hay
   * o si su SDK falla. Devuelve `null` solo cuando tampoco arranca el respaldo.
   */
  private async crearMotor(): Promise<MotorMapa | null> {
    const opciones: OpcionesMotor = {
      lienzo: this.lienzo().nativeElement,
      centro: CENTRO_POR_DEFECTO,
      zoom: ZOOM_POR_DEFECTO,
      zoomConRueda: this.zoomConRueda(),
    };
    const escuchas = {
      alMoverse: (): void => this.anunciarZona(),
      alElegirPunto: (id: string): void => this.puntoElegido.emit(id),
    };

    const clave = await this.geoService.claveMapas().catch(() => '');
    if (clave && !this.destruido) {
      try {
        return await crearMotorGoogle(clave, opciones, escuchas);
      } catch {
        // Clave inválida, cuota agotada o red caída: mejor OpenStreetMap que
        // un hueco gris donde deberían salir los listados.
      }
    }

    if (this.destruido) return null;
    try {
      return await crearMotorLeaflet(opciones, escuchas);
    } catch {
      return null;
    }
  }

  private pintar(puntos: readonly PuntoMapa[], activo: string | null): void {
    const motor = this.motor;
    if (!motor) return;

    motor.pintar(puntos, activo);

    const conCoordenadas = puntosGeolocalizados(puntos);
    if (conCoordenadas.length === 0 || !this.autoencuadre()) return;
    this.encuadrar(motor, conCoordenadas);
  }

  /**
   * Encaja la vista a todos los puntos. Se marca como movimiento propio para
   * que no se confunda con una navegación del usuario y dispare otra búsqueda.
   */
  private encuadrar(motor: MotorMapa, puntos: PuntoMapa[]): void {
    this.reencuadrando = true;
    try {
      if (puntos.length === 1) {
        motor.centrarEn(puntos[0].lat, puntos[0].lng, ZOOM_PUNTO_UNICO);
      } else {
        motor.encuadrar(puntos);
      }
    } finally {
      // El aviso de movimiento llega en el mismo tick que el reencuadre;
      // liberar la bandera en una macrotarea garantiza que ya ha pasado.
      setTimeout(() => { this.reencuadrando = false; }, 0);
    }
  }

  private anunciarZona(): void {
    if (!this.motor || this.reencuadrando) return;
    if (this.temporizadorMovimiento) clearTimeout(this.temporizadorMovimiento);
    this.temporizadorMovimiento = setTimeout(() => {
      const zona = this.motor?.zonaActual();
      if (zona) this.zonaCambiada.emit(zona);
    }, ESPERA_MOVIMIENTO_MS);
  }
}
