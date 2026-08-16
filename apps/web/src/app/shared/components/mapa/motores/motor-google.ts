import { cargarGoogleMaps } from './google-maps.loader';
import {
  EscuchasMotor, MotorMapa, OpcionesMotor, PuntoMapa, ZonaMapa, puntosGeolocalizados,
} from './motor-mapa';
import { htmlPin, htmlTarjeta } from './pin-html';

/** Margen en píxeles al encajar la vista a los resultados. */
const MARGEN_ENCUADRE = 48;

/** Pin colocado sobre el mapa; añade a la capa de Google la forma de retirarlo. */
type Pin = google.maps.OverlayView & { destruir(): void };
type ConstructorPin = new (punto: PuntoMapa, esActivo: boolean, alPulsar: () => void) => Pin;

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
  }

  pintar(puntos: readonly PuntoMapa[], activo: string | null): void {
    this.limpiarPines();

    for (const punto of puntosGeolocalizados(puntos)) {
      const pin = new this.Pin(punto, punto.id === activo, () => this.alPulsarPin(punto));
      pin.setMap(this.mapa);
      this.pines.push(pin);
    }
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
    this.tarjeta.close();
    this.limpiarPines();
  }

  private alPulsarPin(punto: PuntoMapa): void {
    this.escuchas.alElegirPunto(punto.id);

    const contenido = htmlTarjeta(punto);
    if (!contenido) return;
    this.tarjeta.setContent(contenido);
    this.tarjeta.setPosition({ lat: punto.lat, lng: punto.lng });
    this.tarjeta.open({ map: this.mapa });
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
      private readonly alPulsar: () => void,
    ) {
      super();
    }

    override onAdd(): void {
      const elemento = document.createElement('div');
      elemento.className = 'rs-pin-capa';
      elemento.innerHTML = htmlPin(this.punto, this.esActivo);
      elemento.addEventListener('click', (evento) => {
        evento.stopPropagation();
        this.alPulsar();
      });

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
