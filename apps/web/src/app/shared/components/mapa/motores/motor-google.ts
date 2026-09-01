import { cargarGoogleMaps } from './google-maps.loader';
import {
  COLOR_RUTA, EscuchasMotor, MAX_PARADAS_INTERMEDIAS, MotorMapa, OpcionesMotor, PuntoMapa,
  PuntoRuta, ResumenRuta, ZonaMapa, distanciaEnLineaRecta, puntosGeolocalizados,
} from './motor-mapa';
import { htmlPin, htmlTarjeta } from './pin-html';

/** Suma los tramos que devuelve Directions: metros y segundos a km y minutos. */
function resumirTramos(tramos: readonly google.maps.DirectionsLeg[]): ResumenRuta {
  let metros = 0;
  let segundos = 0;
  for (const tramo of tramos) {
    metros += tramo.distance?.value ?? 0;
    segundos += tramo.duration?.value ?? 0;
  }
  return {
    distanciaKm: Math.round(metros / 1000),
    duracionMin: Math.round(segundos / 60),
    porCarretera: true,
  };
}

/** Margen en píxeles al encajar la vista a los resultados. */
const MARGEN_ENCUADRE = 48;

/** Pin colocado sobre el mapa; añade a la capa de Google la forma de retirarlo. */
type Pin = google.maps.OverlayView & { destruir(): void };
type ConstructorPin = new (
  punto: PuntoMapa,
  esActivo: boolean,
  escuchas: { alPulsar: () => void; alEntrar: () => void; alSalir: () => void },
) => Pin;

/**
 * Mapa pintado con Google Maps JavaScript: es el proveedor que pide el cliente
 * y el mismo que ya alimenta el buscador de poblaciones (Places) y el cálculo
 * de trayectos (Routes), así que los listados salen sobre la cartografía que el
 * usuario reconoce.
 */
export async function crearMotorGoogle(
  apiKey: string,
  opciones: OpcionesMotor,
  escuchas: EscuchasMotor,
): Promise<MotorMapa> {
  const maps = await cargarGoogleMaps(apiKey);
  return new MotorGoogle(maps, opciones, escuchas);
}

class MotorGoogle implements MotorMapa {
  private readonly mapa: google.maps.Map;
  private readonly tarjeta: google.maps.InfoWindow;
  private readonly Pin: ConstructorPin;
  private pines: Pin[] = [];

  constructor(
    private readonly maps: typeof google.maps,
    opciones: OpcionesMotor,
    private readonly escuchas: EscuchasMotor,
  ) {
    this.sinTarjetas = opciones.permitePulsar === true;
    const [lat, lng] = opciones.centro;
    this.mapa = new maps.Map(opciones.lienzo, {
      center: { lat, lng },
      zoom: opciones.zoom,
      // Sin esto, en móvil un dedo sobre el mapa arrastra el mapa en vez de
      // rodar la página y el usuario se queda atrapado a mitad del listado.
      gestureHandling: opciones.zoomConRueda ? 'greedy' : 'cooperative',
      zoomControl: opciones.zoomConRueda,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      // Los comercios de Google no son resultados nuestros: pulsarlos abriría
      // una ficha ajena al catálogo desde dentro del buscador.
      clickableIcons: false,
    });

    this.tarjeta = new maps.InfoWindow({ disableAutoPan: false });
    this.Pin = definirPin(maps);

    // Google lanza un `idle` nada más terminar de montarse. Anunciarlo como
    // movimiento haría que el mapa pidiese una búsqueda por su rectángulo
    // inicial y tirase por tierra la ciudad que el usuario acababa de escribir;
    // solo cuentan los `idle` posteriores, que ya sí son suyos.
    maps.event.addListenerOnce(this.mapa, 'idle', () => {
      this.mapa.addListener('idle', () => this.escuchas.alMoverse());
    });

    if (opciones.permitePulsar) {
      this.mapa.addListener('click', (evento: google.maps.MapMouseEvent) => {
        const punto = evento.latLng;
        if (punto) this.escuchas.alPulsarMapa?.(punto.lat(), punto.lng());
      });
    }
  }

  /** El mapa está colocando un punto, no enseñando resultados. */
  private readonly sinTarjetas: boolean;

  /** Línea recta de respaldo, cuando no se ha podido pedir la ruta real. */
  private ruta: google.maps.Polyline | null = null;
  /** Capa que dibuja el camino por carretera que devuelve Directions. */
  private trazado: google.maps.DirectionsRenderer | null = null;

  pintar(puntos: readonly PuntoMapa[], activo: string | null): void {
    this.limpiarPines();

    for (const punto of puntosGeolocalizados(puntos)) {
      const pin = new this.Pin(punto, punto.id === activo, {
        alPulsar: () => this.alPulsarPin(punto),
        // Sin tarjetas cuando el mapa sirve para colocar el punto: taparían el
        // sitio al que se apunta y no dirían nada nuevo.
        alEntrar: () => { if (!this.sinTarjetas) this.mostrarTarjeta(punto); },
        alSalir: () => this.programarCierre(),
      });
      pin.setMap(this.mapa);
      this.pines.push(pin);
    }
  }

  /**
   * Traza el trayecto por carretera con Directions, pasando por cada punto de
   * recogida en orden.
   *
   * Se pide la ruta real y no una línea recta porque lo que se está enseñando
   * es un viaje: la recta entre Madrid y Santander cruza la cordillera, y el
   * transportista cobra por los kilómetros que hace de verdad. Si Directions no
   * contesta —cuota, red, una parada donde no llega una carretera— se cae a la
   * recta antes que dejar el mapa vacío, y se avisa de que lo es.
   */
  async pintarRuta(paradas: readonly PuntoRuta[]): Promise<ResumenRuta | null> {
    this.limpiarRuta();
    if (paradas.length < 2) return null;

    const porCarretera = await this.trazarPorCarretera(paradas);
    if (porCarretera) return porCarretera;

    this.ruta = new this.maps.Polyline({
      path: paradas.map((p) => ({ lat: p.lat, lng: p.lng })),
      strokeColor: COLOR_RUTA,
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map: this.mapa,
    });
    return { distanciaKm: distanciaEnLineaRecta(paradas), duracionMin: 0, porCarretera: false };
  }

  /** La ruta real, o `null` si Directions no la puede dar. */
  private async trazarPorCarretera(paradas: readonly PuntoRuta[]): Promise<ResumenRuta | null> {
    // Directions admite un número limitado de paradas intermedias; pedir más
    // devuelve un error y dejaría el trayecto sin dibujar.
    const puntos = paradas.slice(0, MAX_PARADAS_INTERMEDIAS + 2);
    const origen = puntos[0];
    const destino = puntos[puntos.length - 1];

    try {
      const respuesta = await new this.maps.DirectionsService().route({
        origin: { lat: origen.lat, lng: origen.lng },
        destination: { lat: destino.lat, lng: destino.lng },
        waypoints: puntos.slice(1, -1).map((p) => ({
          location: { lat: p.lat, lng: p.lng }, stopover: true,
        })),
        travelMode: this.maps.TravelMode.DRIVING,
        region: 'ES',
      });

      const tramos = respuesta.routes[0]?.legs;
      if (!tramos?.length) return null;

      this.trazado = new this.maps.DirectionsRenderer({
        // Los pines numerados los pone el componente: los de Google saldrían
        // encima con otra forma y otro orden.
        suppressMarkers: true,
        // El encuadre lo decide quien hospeda el mapa, que sabe qué más hay.
        preserveViewport: true,
        polylineOptions: { strokeColor: COLOR_RUTA, strokeOpacity: 0.9, strokeWeight: 5 },
      });
      this.trazado.setMap(this.mapa);
      this.trazado.setDirections(respuesta);

      return resumirTramos(tramos);
    } catch {
      return null;
    }
  }

  private limpiarRuta(): void {
    this.ruta?.setMap(null);
    this.ruta = null;
    this.trazado?.setMap(null);
    this.trazado = null;
  }

  encuadrar(puntos: readonly PuntoMapa[]): void {
    const limites = new this.maps.LatLngBounds();
    for (const punto of puntos) limites.extend({ lat: punto.lat, lng: punto.lng });
    this.mapa.fitBounds(limites, MARGEN_ENCUADRE);
  }

  centrarEn(lat: number, lng: number, zoom: number): void {
    this.mapa.setCenter({ lat, lng });
    this.mapa.setZoom(zoom);
  }

  zonaActual(): ZonaMapa | null {
    const limites = this.mapa.getBounds();
    const centro = this.mapa.getCenter();
    const zoom = this.mapa.getZoom();
    // Antes del primer `idle` el mapa todavía no sabe qué rectángulo enseña.
    if (!limites || !centro || zoom == null) return null;

    const suroeste = limites.getSouthWest();
    const noreste = limites.getNorthEast();
    return {
      swLat: suroeste.lat(),
      swLng: suroeste.lng(),
      neLat: noreste.lat(),
      neLng: noreste.lng(),
      centroLat: centro.lat(),
      centroLng: centro.lng(),
      zoom,
    };
  }

  /**
   * Google reajusta el lienzo solo, pero al pasar de oculto a visible pierde el
   * centro; reponerlo evita que el mapa aparezca mirando al Atlántico.
   */
  refrescar(): void {
    const centro = this.mapa.getCenter();
    if (centro) this.mapa.setCenter(centro);
  }

  destruir(): void {
    this.limpiarRuta();
    this.cancelarCierre();
    this.tarjeta.close();
    this.limpiarPines();
  }

  private alPulsarPin(punto: PuntoMapa): void {
    this.escuchas.alElegirPunto(punto.id);
    this.mostrarTarjeta(punto);
  }

  /**
   * Margen para llegar del pin a la tarjeta: entre uno y otra hay unos píxeles
   * de mapa, y sin este respiro se cierra justo cuando se va a leer.
   */
  private static readonly ESPERA_CIERRE_MS = 220;

  private cierre: ReturnType<typeof setTimeout> | null = null;

  /**
   * Abre la tarjeta del punto. La usan tanto el click como el paso del ratón:
   * con los pines convertidos en iconos, el nombre del sitio no se ve en el
   * mapa, y recorrerlo obligaba a pulsar uno a uno para saber qué era cada cosa.
   */
  private mostrarTarjeta(punto: PuntoMapa): void {
    this.cancelarCierre();

    const contenido = htmlTarjeta(punto);
    if (!contenido) return;
    this.tarjeta.setContent(contenido);
    this.tarjeta.setPosition({ lat: punto.lat, lng: punto.lng });
    this.tarjeta.open({ map: this.mapa });
  }

  private programarCierre(): void {
    this.cancelarCierre();
    this.cierre = setTimeout(() => this.tarjeta.close(), MotorGoogle.ESPERA_CIERRE_MS);
  }

  private cancelarCierre(): void {
    if (this.cierre === null) return;
    clearTimeout(this.cierre);
    this.cierre = null;
  }

  private limpiarPines(): void {
    for (const pin of this.pines) pin.destruir();
    this.pines = [];
  }
}

/**
 * Los pines son HTML propio (la píldora con el precio, igual que en el listado)
 * y no marcadores con imagen, así que se colocan con una capa de Google.
 * La clase se define aquí dentro porque hereda de `OverlayView`, que no existe
 * hasta que el SDK termina de cargarse.
 */
function definirPin(maps: typeof google.maps): ConstructorPin {
  return class Pin extends maps.OverlayView {
    private elemento: HTMLElement | null = null;

    constructor(
      private readonly punto: PuntoMapa,
      private readonly esActivo: boolean,
      private readonly escuchas: { alPulsar: () => void; alEntrar: () => void; alSalir: () => void },
    ) {
      super();
    }

    override onAdd(): void {
      const elemento = document.createElement('div');
      elemento.className = 'rs-pin-capa';
      elemento.innerHTML = htmlPin(this.punto, this.esActivo);
      elemento.addEventListener('click', (evento) => {
        evento.stopPropagation();
        this.escuchas.alPulsar();
      });

      // En táctil no hay hover, así que el click sigue siendo el que manda.
      elemento.addEventListener('mouseenter', () => this.escuchas.alEntrar());
      elemento.addEventListener('mouseleave', () => this.escuchas.alSalir());

      // `overlayMouseTarget` es la capa que recibe eventos de puntero; en las
      // de dibujo el pin se vería pero no se podría pulsar.
      this.getPanes()?.overlayMouseTarget.appendChild(elemento);
      this.elemento = elemento;
    }

    override draw(): void {
      const proyeccion = this.getProjection();
      if (!proyeccion || !this.elemento) return;

      const pixeles = proyeccion.fromLatLngToDivPixel(
        new maps.LatLng(this.punto.lat, this.punto.lng),
      );
      if (!pixeles) return;

      this.elemento.style.left = `${pixeles.x}px`;
      this.elemento.style.top = `${pixeles.y}px`;
    }

    override onRemove(): void {
      this.elemento?.remove();
      this.elemento = null;
    }

    destruir(): void {
      this.setMap(null);
    }
  };
}
