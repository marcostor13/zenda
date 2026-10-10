import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy,
  effect, inject, input, output, viewChild,
} from '@angular/core';
import { GeoService } from '../../../core/geo/geo.service';
import { ConsentimientoService } from '../../../core/cookies/consentimiento.service';
import { crearMotorGoogle } from './motores/motor-google';
import { crearMotorLeaflet } from './motores/motor-leaflet';
import {
  CENTRO_POR_DEFECTO, MotorMapa, OpcionesMotor, PuntoMapa, PuntoRuta, ResumenRuta,
  ZOOM_POR_DEFECTO, ZOOM_PUNTO_UNICO, ZonaMapa, puntosGeolocalizados,
} from './motores/motor-mapa';

export type { PuntoMapa, PuntoRuta, ResumenRuta, ZonaMapa } from './motores/motor-mapa';
export { MAX_PARADAS_INTERMEDIAS } from './motores/motor-mapa';

/**
 * Espera antes de anunciar la zona visible. Arrastrar el mapa dispara un aviso
 * en cada soltar del ratón; sin este margen, un paseo por la costa lanzaría una
 * búsqueda por cada tirón.
 */
const ESPERA_MOVIMIENTO_MS = 400;

/**
 * Margen en el que una pulsación sobre el fondo se atribuye al pin recién
 * elegido. Según el proveedor, pulsar un pin puede avisar también del fondo que
 * hay debajo, y sin este margen la ficha se cerraría nada más abrirse.
 */
const MARGEN_PULSACION_PIN_MS = 300;

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

    /* Pin circular con el icono de la categoría. Se centra sobre la coordenada
       en lugar de colgar de ella por la esquina superior izquierda. */
    :host ::ng-deep .rs-pin {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      /* Objetivo táctil: por debajo de esto, en móvil se falla el pin y se
         acaba arrastrando el mapa. Es cuadrado porque ya no hay texto que
         ensanche unos pines más que otros. */
      width: 34px;
      height: 34px;
      padding: 0;
      border-radius: var(--r-full);
      background: var(--c-card);
      border: 2px solid var(--c-accent);
      box-shadow: 0 2px 6px rgba(0, 0, 0, .25);
      cursor: pointer;
      transition: background .15s, border-color .15s, transform .15s;
    }

    :host ::ng-deep .rs-pin__icono {
      width: 18px;
      height: 18px;
      display: block;
      pointer-events: none;
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

    /* Pin con precio (buscador por mapa): pastilla con el icono y la cifra, y
       una punta debajo que señala el sitio exacto. Cuelga por encima de la
       coordenada en vez de centrarse, o la punta no apuntaría a nada. */
    :host ::ng-deep .rs-pin--precio {
      width: auto;
      height: 30px;
      gap: var(--sp-1);
      padding: 0 var(--sp-3) 0 3px;
      background: var(--dk-blue);
      border-color: var(--c-card);
      color: #fff;
      font-family: var(--font);
      font-size: var(--f-sm);
      font-weight: var(--w-7, 700);
      line-height: 1;
      white-space: nowrap;
      transform: translate(-50%, calc(-100% - 7px));
    }

    :host ::ng-deep .rs-pin--precio .rs-pin__icono {
      width: 22px;
      height: 22px;
      padding: 3px;
      border-radius: var(--r-full);
      background: var(--c-card);
    }

    :host ::ng-deep .rs-pin--precio::after {
      content: '';
      position: absolute;
      left: 50%;
      bottom: -7px;
      width: 10px;
      height: 10px;
      background: inherit;
      border-right: 2px solid var(--c-card);
      border-bottom: 2px solid var(--c-card);
      border-bottom-right-radius: 2px;
      transform: translateX(-50%) rotate(45deg);
    }

    :host ::ng-deep .rs-pin--precio:hover,
    :host ::ng-deep .rs-pin--precio:focus-visible,
    :host ::ng-deep .rs-pin--precio.rs-pin--activo {
      border-color: var(--c-card);
      transform: translate(-50%, calc(-100% - 7px)) scale(1.08);
    }

    /* El pin bajo el ratón sube por encima de los vecinos que lo pisan; los
       dos proveedores fijan el orden en línea, de ahí el !important. */
    :host ::ng-deep .rs-pin-capa:hover,
    :host ::ng-deep .rs-pin-capa:focus-within { z-index: 1001 !important; }

    @media (prefers-reduced-motion: reduce) {
      :host ::ng-deep .rs-pin { transition: none; }
      :host ::ng-deep .rs-pin:hover,
      :host ::ng-deep .rs-pin:focus-visible,
      :host ::ng-deep .rs-pin--activo { transform: translate(-50%, -50%); }
      :host ::ng-deep .rs-pin--precio:hover,
      :host ::ng-deep .rs-pin--precio:focus-visible,
      :host ::ng-deep .rs-pin--precio.rs-pin--activo { transform: translate(-50%, calc(-100% - 7px)); }
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
    :host ::ng-deep .rs-mapa-pop__sub {
      display: block; font-size: 12px; color: var(--t-400);
      line-height: 1.3; margin-bottom: 3px;
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
  /**
   * Paradas de un trayecto, en orden. Se traza el camino que pasa por todas y
   * entran en el encuadre igual que los pines: un trayecto que se sale de la
   * vista no dice nada de por dónde pasa.
   */
  readonly ruta = input<PuntoRuta[]>([]);
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

  /**
   * Pulsar el lienzo recoloca el punto. Sólo lo enciende quien está eligiendo
   * **una** ubicación —el alta de un servicio—: en el buscador, tocar el mapa
   * para pasar de un pin a otro no debe significar mover nada.
   */
  readonly permitePulsar = input(false);

  /** Pinta el precio dentro del pin; sólo en el buscador por mapa. */
  readonly pinesConPrecio = input(false);

  /**
   * Quien hospeda el mapa enseña su propia ficha al elegir un pin, así que no
   * se abre la tarjeta emergente del proveedor.
   */
  readonly fichaExterna = input(false);

  /** Lo que mide el trayecto una vez trazado; `null` si no hay recorrido. */
  readonly rutaTrazada = output<ResumenRuta | null>();
  readonly puntoElegido = output<string>();
  /** Coordenadas del lugar pulsado; sólo con `permitePulsar`. */
  readonly mapaPulsado = output<{ lat: number; lng: number }>();
  /** Pulsación fuera de los pines; sólo con `fichaExterna`. */
  readonly fondoPulsado = output<void>();
  /** Zona visible tras mover o hacer zoom; la dispara solo el usuario. */
  readonly zonaCambiada = output<ZonaMapa>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  private readonly geoService = inject(GeoService);
  private readonly consentimiento = inject(ConsentimientoService);

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
  private ultimoPinElegido = 0;
  /** Lo último que se pintó, para distinguir datos nuevos de un simple resaltado. */
  private puntosPintados: readonly PuntoMapa[] | null = null;
  private rutaPintada: readonly PuntoRuta[] | null = null;

  constructor() {
    // Repinta los pines cuando cambian los puntos o el resaltado, pero solo
    // después de que el mapa exista (el efecto se dispara antes del AfterViewInit).
    effect(() => {
      const puntos = this.puntos();
      const activo = this.activo();
      // Se lee aquí para que el efecto también se dispare al cambiar el
      // trayecto: es lo que reencuadra el mapa al añadir una parada.
      this.ruta();
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
      permitePulsar: this.permitePulsar(),
      pinesConPrecio: this.pinesConPrecio(),
      fichaExterna: this.fichaExterna(),
    };
    const escuchas = {
      alMoverse: (): void => this.anunciarZona(),
      alElegirPunto: (id: string): void => this.elegirPunto(id),
      alPulsarMapa: (lat: number, lng: number): void => this.mapaPulsado.emit({ lat, lng }),
      alPulsarFondo: (): void => this.pulsarFondo(),
    };

    /*
     * Google Maps pone cookies de terceros en cuanto se carga, así que necesita
     * consentimiento. Sin él no se deja al visitante sin mapa: se usa el motor
     * de OpenStreetMap, que sirve las teselas sin cookies. El mapa se ve y se
     * usa igual; lo que cambia es el proveedor.
     */
    const clave = this.consentimiento.permite('preferencias')
      ? await this.geoService.claveMapas().catch(() => '')
      : '';

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

  private elegirPunto(id: string): void {
    this.ultimoPinElegido = Date.now();
    this.puntoElegido.emit(id);
  }

  private pulsarFondo(): void {
    if (Date.now() - this.ultimoPinElegido < MARGEN_PULSACION_PIN_MS) return;
    this.fondoPulsado.emit();
  }

  private pintar(puntos: readonly PuntoMapa[], activo: string | null): void {
    const motor = this.motor;
    if (!motor) return;

    const paradas = this.ruta();
    // Cambiar sólo el pin resaltado repinta los pines y nada más: reencuadrar
    // ahí le movería el mapa a quien acaba de pulsar uno, y volver a pedir la
    // ruta gastaría una consulta a Directions por cada pin que se mira.
    const soloResaltado = puntos === this.puntosPintados && paradas === this.rutaPintada;
    this.puntosPintados = puntos;
    this.rutaPintada = paradas;

    motor.pintar(puntos, activo);
    if (soloResaltado) return;

    // Trazar la ruta va a la red (Google Directions): no se espera aquí para no
    // retrasar el pintado de los pines, que sí es inmediato.
    void motor.pintarRuta(paradas)
      .then((resumen) => { if (!this.destruido) this.rutaTrazada.emit(resumen); })
      .catch(() => { /* sin ruta el mapa sigue enseñando sus pines */ });

    // El trayecto entra en el encuadre como un punto más: si no, añadir una
    // parada fuera de la vista la dibujaría donde no se ve.
    const conCoordenadas = puntosGeolocalizados([
      ...puntos,
      ...paradas.map((p, i) => ({ id: `ruta-${i}`, lat: p.lat, lng: p.lng })),
    ]);
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
