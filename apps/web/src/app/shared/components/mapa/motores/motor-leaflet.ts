import type { Map as LeafletMap, Marker } from 'leaflet';
import {
  EscuchasMotor, MotorMapa, OpcionesMotor, PuntoMapa, ZonaMapa, puntosGeolocalizados,
} from './motor-mapa';
import { htmlPin, htmlTarjeta } from './pin-html';

/** Margen en píxeles al encajar la vista a los resultados. */
const MARGEN_ENCUADRE: [number, number] = [48, 48];

/**
 * Desenvuelve la API real de Leaflet.
 *
 * El paquete solo publica `main` (un UMD), sin `module` ni `exports`, así que
 * el empaquetador no puede deducir sus exportaciones con nombre y entrega un
 * espacio de nombres con todo colgando de `default`. Sin este desenvuelto,
 * `L.map` es `undefined` en el build y **ningún mapa llega a dibujarse** —el
 * fallo queda silencioso, porque `crearMotor()` atrapa la excepción y no hay
 * proveedor de respaldo tras Leaflet—, por mucho que en los tests el `require`
 * de Jest sí devuelva la API plana y el mismo código parezca funcionar ahí.
 */
export function desenvolverLeaflet(modulo: unknown): typeof import('leaflet') {
  const conDefecto = modulo as { default?: typeof import('leaflet') };
  const api = typeof (modulo as typeof import('leaflet')).map === 'function'
    ? (modulo as typeof import('leaflet'))
    : conDefecto.default;
  if (!api || typeof api.map !== 'function') {
    throw new Error('Leaflet se cargó sin su API: no se puede montar el mapa');
  }
  return api;
}

/**
 * Mapa pintado con teselas de OpenStreetMap. Es el **respaldo** de Google Maps:
 * se usa cuando no hay clave de navegador configurada o cuando su SDK no llega
 * a cargarse, para que el buscador por mapa nunca deje un hueco gris.
 *
 * Leaflet se carga con `import()` dinámico y solo en el navegador: toca
 * `window` al importarse, así que un import estático rompería cualquier render
 * en servidor y engordaría el bundle de quien nunca abre el mapa.
 */
export async function crearMotorLeaflet(
  opciones: OpcionesMotor,
  escuchas: EscuchasMotor,
): Promise<MotorMapa> {
  const L = desenvolverLeaflet(await import('leaflet'));
  return new MotorLeaflet(L, opciones, escuchas);
}

class MotorLeaflet implements MotorMapa {
  private readonly mapa: LeafletMap;
  private marcadores: Marker[] = [];

  constructor(
    private readonly L: typeof import('leaflet'),
    opciones: OpcionesMotor,
    private readonly escuchas: EscuchasMotor,
  ) {
    const [lat, lng] = opciones.centro;
    this.mapa = L.map(opciones.lienzo, {
      center: [lat, lng],
      zoom: opciones.zoom,
      scrollWheelZoom: opciones.zoomConRueda,
      // El control por defecto va arriba a la izquierda, justo donde el
      // buscador por mapa coloca su caja "Buscar en el mapa".
      zoomControl: false,
    });

    // En la miniatura del listado no se pone: es decorativa y no se pulsa.
    if (opciones.zoomConRueda) {
      L.control.zoom({ position: 'bottomright' }).addTo(this.mapa);
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; colaboradores de OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.mapa);

    this.mapa.on('moveend', () => this.escuchas.alMoverse());
  }

  pintar(puntos: readonly PuntoMapa[], activo: string | null): void {
    this.limpiarMarcadores();

    for (const punto of puntosGeolocalizados(puntos)) {
      const icono = this.L.divIcon({
        className: 'rs-pin-capa',
        html: htmlPin(punto, punto.id === activo),
        // Tamaño cero: el pin se centra sobre su coordenada por CSS. Dejarlo sin
        // definir hacía que Leaflet lo anclase por la esquina y el precio salía
        // desplazado respecto al sitio que señala.
        iconSize: [0, 0],
      });

      const marcador = this.L.marker([punto.lat, punto.lng], { icon: icono, title: punto.titulo })
        .addTo(this.mapa)
        .on('click', () => this.escuchas.alElegirPunto(punto.id));

      const tarjeta = htmlTarjeta(punto);
      if (tarjeta) marcador.bindPopup(tarjeta, { closeButton: true, offset: [0, -6] });

      this.marcadores.push(marcador);
    }
  }

  encuadrar(puntos: readonly PuntoMapa[]): void {
    const limites = this.L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number]));
    this.mapa.fitBounds(limites, { padding: MARGEN_ENCUADRE });
  }

  centrarEn(lat: number, lng: number, zoom: number): void {
    this.mapa.setView([lat, lng], zoom);
  }

  zonaActual(): ZonaMapa {
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

  refrescar(): void {
    this.mapa.invalidateSize();
  }

  destruir(): void {
    this.limpiarMarcadores();
    this.mapa.remove();
  }

  private limpiarMarcadores(): void {
    for (const marcador of this.marcadores) marcador.remove();
    this.marcadores = [];
  }
}
