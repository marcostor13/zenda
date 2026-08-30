/** Punto pintable en el mapa. `etiqueta` es el precio que se ve en su tarjeta. */
export interface PuntoMapa {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly etiqueta?: string;
  readonly titulo?: string;
  /** Segunda línea de la tarjeta: la ciudad, la zona… Lo que sitúa al punto. */
  readonly subtitulo?: string;
  /**
   * Categoría del servicio: decide qué icono lleva el pin. Sin ella el pin sale
   * con la huella genérica, que es preferible a disfrazarlo de otra categoría.
   */
  readonly vertical?: string;
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

/** Vista inicial y comportamiento del lienzo con el que se monta un motor. */
export interface OpcionesMotor {
  readonly lienzo: HTMLElement;
  readonly centro: readonly [number, number];
  readonly zoom: number;
  /**
   * Permite hacer zoom con la rueda y arrastrar con un solo dedo. Solo lo activa
   * el mapa a pantalla completa: en un mapa embebido dentro de una página que
   * rueda, secuestrar el gesto deja al usuario atrapado sobre el mapa.
   */
  readonly zoomConRueda: boolean;
  /**
   * Engancha la pulsación sobre el lienzo para recolocar un punto.
   *
   * Apaga además las tarjetas emergentes de los pines: cuando el mapa sirve
   * para **colocar** un punto y no para explorar resultados, hay un solo pin,
   * su tarjeta no dice nada que no esté ya en el formulario y tapa justo el
   * trozo de mapa al que se está apuntando.
   */
  readonly permitePulsar?: boolean;
}

/** Avisos que el motor devuelve al componente que lo hospeda. */
export interface EscuchasMotor {
  /** El usuario ha movido o hecho zoom; el hospedador decide si rebuscar. */
  readonly alMoverse: () => void;
  readonly alElegirPunto: (id: string) => void;
  /**
   * Pulsación sobre el lienzo, con las coordenadas del punto tocado. Sólo se
   * engancha si el hospedador la pide (`permitePulsar`): en el buscador, tocar
   * el mapa no debe significar nada, y en el alta de un servicio significa
   * "el sitio es este".
   */
  readonly alPulsarMapa?: (lat: number, lng: number) => void;
}

/**
 * Operaciones de mapa que necesita `RsMapaComponent`, sin decir con qué
 * proveedor se pintan. Existen dos implementaciones —Google Maps y
 * OpenStreetMap— y son intercambiables: el componente elige una al montarse y
 * el resto de la aplicación no se entera de cuál.
 */
export interface MotorMapa {
  /** Redibuja todos los pines; `activo` es el que va resaltado. */
  pintar(puntos: readonly PuntoMapa[], activo: string | null): void;
  /** Encaja la vista a los puntos dados. */
  encuadrar(puntos: readonly PuntoMapa[]): void;
  centrarEn(lat: number, lng: number, zoom: number): void;
  zonaActual(): ZonaMapa | null;
  /** Recalcula el tamaño tras un cambio del contenedor (abrir/cerrar la vista). */
  refrescar(): void;
  destruir(): void;
}

/** Centro por defecto (Madrid) cuando ningún punto trae coordenadas. */
export const CENTRO_POR_DEFECTO: readonly [number, number] = [40.4168, -3.7038];
export const ZOOM_POR_DEFECTO = 11;
/** Zoom al centrar sobre un único resultado; encuadrar daría uno absurdo. */
export const ZOOM_PUNTO_UNICO = 14;

/** Descarta los puntos sin coordenadas utilizables antes de pintarlos. */
export function puntosGeolocalizados(puntos: readonly PuntoMapa[]): PuntoMapa[] {
  return puntos.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}
