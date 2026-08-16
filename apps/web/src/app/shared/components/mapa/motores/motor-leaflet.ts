import type { Map as LeafletMap, Marker } from 'leaflet';
import {
  EscuchasMotor, MotorMapa, OpcionesMotor, PuntoMapa, ZonaMapa, puntosGeolocalizados,
} from './motor-mapa';
import { htmlPin, htmlTarjeta } from './pin-html';

/** Margen en píxeles al encajar la vista a los resultados. */
const MARGEN_ENCUADRE: [number, number] = [48, 48];

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
  const L = await import('leaflet');
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
