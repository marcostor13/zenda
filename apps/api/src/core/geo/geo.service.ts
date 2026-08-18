import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Sugerencia de población devuelta al buscador. */
export interface SugerenciaLugar {
  placeId: string;
  /** Texto completo: "Valencia, España". */
  descripcion: string;
  /** Nombre de la población: "Valencia". */
  principal: string;
  /** Contexto: "Comunidad Valenciana, España". */
  secundario: string;
}

/** Coordenadas de una población, para ordenar resultados por distancia. */
export interface CoordenadasLugar {
  ciudad: string;
  lat: number;
  lng: number;
}

/**
 * Dirección postal ya desmenuzada, tal y como la necesita el formulario del
 * comercio. Se devuelve entera para que el panel no tenga que interpretar el
 * texto formateado de Google, que cambia de formato según el país.
 */
export interface DireccionLugar {
  calle: string;
  numero: string;
  codigoPostal: string;
  ciudad: string;
  provincia: string;
  pais: string;
  /** Texto completo tal y como lo escribe Google, para mostrarlo de un vistazo. */
  formateada: string;
  lat: number;
  lng: number;
}

/**
 * Qué se está buscando. `ciudad` alimenta el buscador (poblaciones); `direccion`
 * alimenta la ficha del comercio, donde hace falta calle y número exactos.
 */
export type TipoLugar = 'ciudad' | 'direccion';

/** Tipos de Places por cada búsqueda. `address` = portales con calle y número. */
const TIPOS_PLACES: Record<TipoLugar, string[]> = {
  ciudad: ['locality', 'administrative_area_level_2'],
  direccion: ['street_address', 'premise', 'subpremise', 'route'],
};

/** Componente de dirección de Google, recortado a lo que se usa. */
interface ComponenteDireccion {
  longText?: string;
  shortText?: string;
  types?: string[];
}

/** Tipos de cambio con el euro como base (la moneda de cobro nunca cambia). */
export interface TiposDeCambio {
  base: 'EUR';
  fecha: string;
  tasas: Record<string, number>;
}

/** Trayecto entre dos direcciones, para tarificar el transporte. */
export interface Trayecto {
  km: number;
  duracionMin: number;
  /** true = medido por carretera; false = estimación en línea recta. */
  esEstimacion: boolean;
}

/** Lo poco de la configuración de mapas que el navegador necesita conocer. */
export interface ConfigMapas {
  /**
   * Clave de navegador para cargar Maps JavaScript. Cadena vacía = sin clave,
   * y entonces el frontend pinta el mapa con teselas de OpenStreetMap.
   */
  mapsApiKey: string;
}

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FX_URL = 'https://api.frankfurter.app/latest?from=EUR';

/** La carretera es más larga que la línea recta; factor habitual en Europa. */
const FACTOR_SINUOSIDAD = 1.3;
/** Velocidad media de referencia para estimar la duración sin datos de ruta. */
const VELOCIDAD_MEDIA_KMH = 70;

/** Mercado europeo (§9 de CLAUDE.md): el autocompletado no sale de estos países. */
const PAISES = ['es', 'pt', 'fr', 'it', 'de'];

const TTL_SUGERENCIAS_MS = 24 * 60 * 60 * 1000;
const TTL_COORDENADAS_MS = 30 * 24 * 60 * 60 * 1000; // una ciudad no se mueve
const TTL_TRAYECTO_MS = 7 * 24 * 60 * 60 * 1000; // una ruta tampoco cambia
const TTL_CAMBIO_MS = 24 * 60 * 60 * 1000;

/**
 * Tope de entradas por caché. Las alimentan endpoints públicos y sin sesión, y
 * las entradas caducadas sólo se borraban si alguien volvía a pedir esa misma
 * clave: bastaba pedir términos siempre distintos para hacer crecer los mapas
 * sin límite hasta agotar la memoria del proceso.
 */
const MAX_ENTRADAS_CACHE = 5_000;

interface Entrada<T> {
  valor: T;
  expiraEn: number;
}

/** Respuesta de Places Autocomplete (New), recortada a lo que se usa. */
interface RespuestaAutocomplete {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
}

interface RespuestaDetalles {
  location?: { latitude?: number; longitude?: number };
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: ComponenteDireccion[];
}

/**
 * Fachada de servicios de mapas y divisas. Existe para que la clave de Google
 * **nunca** viaje al navegador y para cachear respuestas: Places factura por
 * sesión y las mismas ciudades se buscan una y otra vez.
 *
 * Degrada siempre en silencio: si falta la clave o el proveedor falla, devuelve
 * vacío y el buscador sigue funcionando con texto libre.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly apiKey?: string;
  private readonly browserKey?: string;

  private readonly cacheSugerencias = new Map<string, Entrada<SugerenciaLugar[]>>();
  private readonly cacheCoordenadas = new Map<string, Entrada<CoordenadasLugar>>();
  private readonly cacheDirecciones = new Map<string, Entrada<DireccionLugar>>();
  private readonly cacheTrayectos = new Map<string, Entrada<Trayecto>>();
  private cacheCambio?: Entrada<TiposDeCambio>;

  constructor(config: ConfigService) {
    // Lectura no-eager, igual que la búsqueda con IA: el API arranca sin clave.
    this.apiKey = config.get<string>('GOOGLE_MAPS_API_KEY');
    this.browserKey = config.get<string>('GOOGLE_MAPS_BROWSER_KEY');
  }

  /** true si el proxy puede responder; el frontend lo usa para degradar la UI. */
  get estaConfigurado(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Configuración que sí puede viajar al navegador. Es una clave aparte y
   * restringida por dominio a propósito: Maps JavaScript se ejecuta en el
   * cliente, así que su clave es pública, mientras que `GOOGLE_MAPS_API_KEY`
   * es de servidor y publicarla dejaría facturar Places contra ella.
   */
  configMapas(): ConfigMapas {
    return { mapsApiKey: this.browserKey?.trim() ?? '' };
  }

  async autocompletar(
    termino: string,
    sessionToken?: string,
    tipo: TipoLugar = 'ciudad',
  ): Promise<SugerenciaLugar[]> {
    const consulta = termino.trim();
    if (!consulta || !this.apiKey) return [];

    // El tipo entra en la clave: "Calle Mayor" no devuelve lo mismo buscando
    // poblaciones que buscando portales.
    const clave = `${tipo}:${consulta.toLowerCase()}`;
    const cacheado = this.leerCache(this.cacheSugerencias, clave);
    if (cacheado) return cacheado;

    try {
      const respuesta = await fetch(PLACES_AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          input: consulta,
          includedPrimaryTypes: TIPOS_PLACES[tipo],
          includedRegionCodes: PAISES,
          languageCode: 'es',
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });

      if (!respuesta.ok) throw new Error(`Places autocomplete: ${respuesta.status}`);

      const datos = (await respuesta.json()) as RespuestaAutocomplete;
      const sugerencias = (datos.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
        .map((p) => ({
          placeId: p.placeId as string,
          descripcion: p.text?.text ?? '',
          principal: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
          secundario: p.structuredFormat?.secondaryText?.text ?? '',
        }));

      this.escribirCache(this.cacheSugerencias, clave, sugerencias, TTL_SUGERENCIAS_MS);
      return sugerencias;
    } catch (error) {
      this.logger.warn(`Autocompletado no disponible para "${consulta}": ${this.mensaje(error)}`);
      return [];
    }
  }

  /** Coordenadas de una población ya elegida, para el orden por distancia. */
  async coordenadas(placeId: string): Promise<CoordenadasLugar | null> {
    if (!placeId || !this.apiKey) return null;

    const cacheado = this.leerCache(this.cacheCoordenadas, placeId);
    if (cacheado) return cacheado;

    try {
      const respuesta = await fetch(`${PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'location,displayName',
        },
      });

      if (!respuesta.ok) throw new Error(`Places details: ${respuesta.status}`);

      const datos = (await respuesta.json()) as RespuestaDetalles;
      const lat = datos.location?.latitude;
      const lng = datos.location?.longitude;
      if (lat == null || lng == null) return null;

      const lugar: CoordenadasLugar = { ciudad: datos.displayName?.text ?? '', lat, lng };
      this.escribirCache(this.cacheCoordenadas, placeId, lugar, TTL_COORDENADAS_MS);
      return lugar;
    } catch (error) {
      this.logger.warn(`Sin coordenadas para ${placeId}: ${this.mensaje(error)}`);
      return null;
    }
  }

  /**
   * Dirección postal completa de un portal ya elegido, con sus coordenadas. Es
   * lo que rellena la ficha del comercio: sin esto el comercio teclea la calle a
   * mano y la plataforma se queda sin el punto exacto con el que situarlo en el
   * mapa del buscador.
   */
  async direccion(placeId: string): Promise<DireccionLugar | null> {
    if (!placeId || !this.apiKey) return null;

    const cacheado = this.leerCache(this.cacheDirecciones, placeId);
    if (cacheado) return cacheado;

    try {
      const respuesta = await fetch(`${PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'location,formattedAddress,addressComponents',
        },
      });

      if (!respuesta.ok) throw new Error(`Places details: ${respuesta.status}`);

      const datos = (await respuesta.json()) as RespuestaDetalles;
      const lat = datos.location?.latitude;
      const lng = datos.location?.longitude;
      if (lat == null || lng == null) return null;

      const direccion = this.componerDireccion(datos, lat, lng);
      this.escribirCache(this.cacheDirecciones, placeId, direccion, TTL_COORDENADAS_MS);
      return direccion;
    } catch (error) {
      this.logger.warn(`Sin dirección para ${placeId}: ${this.mensaje(error)}`);
      return null;
    }
  }

  /**
   * Traduce los componentes de Google a los campos del formulario. Se buscan
   * alternativas por campo porque no todos los países usan los mismos tipos:
   * en España la provincia es `administrative_area_level_2`, pero en las
   * ciudades autónomas y en otros países llega sólo el nivel 1.
   */
  private componerDireccion(datos: RespuestaDetalles, lat: number, lng: number): DireccionLugar {
    const componentes = datos.addressComponents ?? [];
    const buscar = (...tipos: string[]): string => {
      for (const tipo of tipos) {
        const encontrado = componentes.find((c) => c.types?.includes(tipo));
        if (encontrado?.longText) return encontrado.longText;
      }
      return '';
    };

    return {
      calle: buscar('route'),
      numero: buscar('street_number'),
      codigoPostal: buscar('postal_code'),
      ciudad: buscar('locality', 'postal_town', 'administrative_area_level_3'),
      provincia: buscar('administrative_area_level_2', 'administrative_area_level_1'),
      pais: buscar('country'),
      formateada: datos.formattedAddress ?? '',
      lat,
      lng,
    };
  }

  /**
   * Distancia y duración del trayecto entre dos poblaciones ya elegidas.
   * Las rutas no cambian, así que se cachean durante una semana por par.
   *
   * Sin proveedor disponible cae a la distancia en línea recta corregida por un
   * factor de sinuosidad: es una estimación, y se marca como tal para que la UI
   * pueda advertirlo en vez de dar un precio como si fuera firme.
   */
  async trayecto(placeIdOrigen: string, placeIdDestino: string): Promise<Trayecto | null> {
    if (!placeIdOrigen || !placeIdDestino) return null;

    const clave = `${placeIdOrigen}>${placeIdDestino}`;
    const cacheado = this.leerCache(this.cacheTrayectos, clave);
    if (cacheado) return cacheado;

    const [origen, destino] = await Promise.all([
      this.coordenadas(placeIdOrigen),
      this.coordenadas(placeIdDestino),
    ]);
    if (!origen || !destino) return null;

    const trayecto = await this.rutaPorCarretera(origen, destino)
      ?? this.rutaEnLineaRecta(origen, destino);

    this.escribirCache(this.cacheTrayectos, clave, trayecto, TTL_TRAYECTO_MS);
    return trayecto;
  }

  private async rutaPorCarretera(
    origen: CoordenadasLugar,
    destino: CoordenadasLugar,
  ): Promise<Trayecto | null> {
    if (!this.apiKey) return null;

    try {
      const respuesta = await fetch(ROUTES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origen.lat, longitude: origen.lng } } },
          destination: { location: { latLng: { latitude: destino.lat, longitude: destino.lng } } },
          travelMode: 'DRIVE',
        }),
      });

      if (!respuesta.ok) throw new Error(`Routes: ${respuesta.status}`);

      const datos = (await respuesta.json()) as {
        routes?: Array<{ distanceMeters?: number; duration?: string }>;
      };
      const ruta = datos.routes?.[0];
      if (!ruta?.distanceMeters) return null;

      return {
        // Al alza en medios kilómetros: nunca se factura menos de lo recorrido.
        km: Math.ceil((ruta.distanceMeters / 1000) * 2) / 2,
        duracionMin: Math.round(Number((ruta.duration ?? '0s').replace('s', '')) / 60),
        esEstimacion: false,
      };
    } catch (error) {
      this.logger.warn(`Ruta no disponible: ${this.mensaje(error)}`);
      return null;
    }
  }

  /** Haversine con factor de sinuosidad: la carretera nunca es una línea recta. */
  private rutaEnLineaRecta(origen: CoordenadasLugar, destino: CoordenadasLugar): Trayecto {
    const RADIO_TIERRA_KM = 6371;
    const aRadianes = (grados: number): number => (grados * Math.PI) / 180;

    const dLat = aRadianes(destino.lat - origen.lat);
    const dLng = aRadianes(destino.lng - origen.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aRadianes(origen.lat)) * Math.cos(aRadianes(destino.lat)) * Math.sin(dLng / 2) ** 2;
    const kmRectos = RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = Math.ceil(kmRectos * FACTOR_SINUOSIDAD * 2) / 2;

    return { km, duracionMin: Math.round((km / VELOCIDAD_MEDIA_KMH) * 60), esEstimacion: true };
  }

  /**
   * Tipos de cambio del BCE. Son **informativos**: el cobro sigue siendo en EUR,
   * así que un fallo aquí solo significa mostrar los precios en euros.
   */
  async tiposDeCambio(): Promise<TiposDeCambio> {
    if (this.cacheCambio && this.cacheCambio.expiraEn > Date.now()) {
      return this.cacheCambio.valor;
    }

    try {
      const respuesta = await fetch(FX_URL);
      if (!respuesta.ok) throw new Error(`Tipos de cambio: ${respuesta.status}`);

      const datos = (await respuesta.json()) as { date?: string; rates?: Record<string, number> };
      const valor: TiposDeCambio = {
        base: 'EUR',
        fecha: datos.date ?? new Date().toISOString().slice(0, 10),
        tasas: { EUR: 1, ...(datos.rates ?? {}) },
      };

      this.cacheCambio = { valor, expiraEn: Date.now() + TTL_CAMBIO_MS };
      return valor;
    } catch (error) {
      this.logger.warn(`Tipos de cambio no disponibles: ${this.mensaje(error)}`);
      return { base: 'EUR', fecha: new Date().toISOString().slice(0, 10), tasas: { EUR: 1 } };
    }
  }

  private leerCache<T>(cache: Map<string, Entrada<T>>, clave: string): T | null {
    const entrada = cache.get(clave);
    if (!entrada) return null;
    if (entrada.expiraEn <= Date.now()) {
      cache.delete(clave);
      return null;
    }
    return entrada.valor;
  }

  private escribirCache<T>(cache: Map<string, Entrada<T>>, clave: string, valor: T, ttlMs: number): void {
    if (cache.size >= MAX_ENTRADAS_CACHE) {
      this.desalojarMasAntigua(cache);
    }

    cache.set(clave, { valor, expiraEn: Date.now() + ttlMs });
  }

  /**
   * Descarta la entrada insertada hace más tiempo. `Map` conserva el orden de
   * inserción, así que la primera clave que devuelve el iterador es la más
   * vieja: un LRU aproximado sin estructura adicional.
   */
  private desalojarMasAntigua<T>(cache: Map<string, Entrada<T>>): void {
    const masAntigua = cache.keys().next();
    if (!masAntigua.done) cache.delete(masAntigua.value);
  }

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }
}
