import { Logger } from '@nestjs/common';
import type {
  CoordenadasLugar, DireccionLugar, SugerenciaLugar, TipoLugar,
} from './geo.service';

/**
 * Búsqueda de lugares con Nominatim (OpenStreetMap), como respaldo de Places.
 *
 * Existe porque el autocompletado de la calle no tenía ninguna alternativa: el
 * campo de población degrada a un catálogo local de municipios, pero el de
 * dirección devolvía lista vacía en cuanto Google no respondía —clave
 * caducada, suspendida o cuota agotada— y el comercio se quedaba sin poder
 * rellenar su ubicación. Un proveedor que no necesita clave quita ese único
 * punto de fallo.
 *
 * No sustituye a Places: es menos preciso con los portales y va limitado a una
 * consulta por segundo. Sólo entra cuando Google no está disponible.
 */

const BUSQUEDA_URL = 'https://nominatim.openstreetmap.org/search';
const CONSULTA_URL = 'https://nominatim.openstreetmap.org/lookup';
const INVERSA_URL = 'https://nominatim.openstreetmap.org/reverse';

/** Marca los identificadores que salen de OSM, para saber a quién preguntar. */
export const PREFIJO_OSM = 'osm:';

/** Mismo mercado europeo que Places (§9 de CLAUDE.md). */
const PAISES = 'es,pt,fr,it,de';

const MAX_RESULTADOS = 6;

/**
 * Nominatim admite **una consulta por segundo** y exige un User-Agent que
 * identifique a quien llama. No es una recomendación: es su condición de uso, y
 * saltársela acaba en bloqueo por IP.
 */
const ESPACIADO_MS = 1_100;
const USER_AGENT = 'Doogking/1.0 (autocompletado de direcciones; contacto: soporte@doogking.com)';

/**
 * Tope de peticiones esperando turno. Con el espaciado de un segundo, una cola
 * larga significa que el usuario ya ha dejado de mirar: mejor devolver vacío
 * que encadenar esperas de diez segundos.
 */
const MAX_EN_COLA = 6;

/** Milisegundos que se concede a Nominatim antes de darlo por perdido. */
const TIMEOUT_MS = 5_000;

/** Un resultado de Nominatim, recortado a lo que se usa. */
interface ResultadoOsm {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    province?: string;
    state?: string;
    country?: string;
  };
}

/** Letra que Nominatim usa para cada tipo de elemento en `osm_ids`. */
const LETRA: Record<string, string> = { node: 'N', way: 'W', relation: 'R' };

export function esIdOsm(placeId: string): boolean {
  return placeId.startsWith(PREFIJO_OSM);
}

export class ProveedorOsm {
  private readonly logger = new Logger(ProveedorOsm.name);

  /** Instante en que quedará libre el siguiente hueco de llamada. */
  private huecoLibreEn = 0;
  private enCola = 0;

  /** Sugerencias para el desplegable. Lista vacía ante cualquier problema. */
  async sugerencias(consulta: string, tipo: TipoLugar): Promise<SugerenciaLugar[]> {
    const resultados = await this.buscar(consulta, tipo);
    return resultados.map((r) => this.aSugerencia(r, tipo));
  }

  /**
   * Dirección postal completa de un resultado ya elegido.
   *
   * Nominatim ya devuelve la dirección desmenuzada en la propia búsqueda, así
   * que lo normal es que esto salga de la caché sin tocar la red; el `lookup`
   * es sólo para cuando la entrada ya ha caducado.
   */
  async direccion(placeId: string): Promise<DireccionLugar | null> {
    const resultado = await this.consultar(placeId);
    return resultado ? this.aDireccion(resultado) : null;
  }

  /**
   * Dirección postal del punto exacto: lo que hay en unas coordenadas.
   *
   * Lo pide el mapa del alta de un servicio cuando el comercio arrastra el pin
   * para corregir la ubicación; sin esto el punto quedaría bien y la dirección
   * escrita seguiría apuntando al sitio anterior.
   */
  async inversa(lat: number, lng: number): Promise<DireccionLugar | null> {
    const parametros = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'es',
    });

    const resultado = await this.pedirUno(`${INVERSA_URL}?${parametros}`);
    return resultado ? this.aDireccion(resultado) : null;
  }

  async coordenadas(placeId: string): Promise<CoordenadasLugar | null> {
    const resultado = await this.consultar(placeId);
    if (!resultado) return null;

    const punto = this.punto(resultado);
    return punto ? { ciudad: this.poblacion(resultado), ...punto } : null;
  }

  /** Convierte un resultado en la dirección que rellena el formulario. */
  aDireccion(resultado: ResultadoOsm): DireccionLugar | null {
    const punto = this.punto(resultado);
    if (!punto) return null;

    const direccion = resultado.address ?? {};
    return {
      calle: direccion.road ?? direccion.pedestrian ?? '',
      numero: direccion.house_number ?? '',
      codigoPostal: direccion.postcode ?? '',
      ciudad: this.poblacion(resultado),
      provincia: direccion.province ?? direccion.state ?? '',
      pais: direccion.country ?? '',
      formateada: resultado.display_name ?? '',
      ...punto,
    };
  }

  /**
   * Busca y devuelve cada resultado junto a su dirección ya resuelta, para que
   * quien llame pueda cachearla y ahorrarse el `lookup` posterior.
   */
  async sugerenciasConDireccion(
    consulta: string,
    tipo: TipoLugar,
  ): Promise<Array<{ sugerencia: SugerenciaLugar; direccion: DireccionLugar | null }>> {
    const resultados = await this.buscar(consulta, tipo);

    return resultados.map((r) => ({
      sugerencia: this.aSugerencia(r, tipo),
      direccion: this.aDireccion(r),
    }));
  }

  private async buscar(consulta: string, tipo: TipoLugar): Promise<ResultadoOsm[]> {
    const parametros = new URLSearchParams({
      q: consulta,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(MAX_RESULTADOS),
      countrycodes: PAISES,
      'accept-language': 'es',
    });
    // `settlement` agrupa ciudad, pueblo y aldea; sin filtro, buscar "Valencia"
    // devuelve antes una calle llamada Valencia que la propia ciudad.
    if (tipo === 'ciudad') parametros.set('featureType', 'settlement');

    return (await this.pedir(`${BUSQUEDA_URL}?${parametros}`)) ?? [];
  }

  private async consultar(placeId: string): Promise<ResultadoOsm | null> {
    const parametros = new URLSearchParams({
      osm_ids: placeId.slice(PREFIJO_OSM.length),
      format: 'jsonv2',
      addressdetails: '1',
      'accept-language': 'es',
    });

    const resultados = await this.pedir(`${CONSULTA_URL}?${parametros}`);
    return resultados?.[0] ?? null;
  }

  /** Igual que `pedir`, para los endpoints que devuelven un objeto suelto. */
  private async pedirUno(url: string): Promise<ResultadoOsm | null> {
    const datos = await this.pedirJson(url);
    return datos && !Array.isArray(datos) ? (datos as ResultadoOsm) : null;
  }

  private async pedir(url: string): Promise<ResultadoOsm[] | null> {
    const datos = await this.pedirJson(url);
    if (datos === null) return null;
    return Array.isArray(datos) ? (datos as ResultadoOsm[]) : [];
  }

  private async pedirJson(url: string): Promise<unknown> {
    if (!(await this.esperarTurno())) return null;

    try {
      const respuesta = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!respuesta.ok) throw new Error(`Nominatim: ${respuesta.status}`);

      return (await respuesta.json()) as unknown;
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Nominatim no respondió: ${motivo}`);
      return null;
    }
  }

  /**
   * Reserva el siguiente hueco de llamada y espera a que llegue. Devuelve false
   * si ya hay demasiadas esperando: entonces se responde vacío en el acto.
   */
  private async esperarTurno(): Promise<boolean> {
    if (this.enCola >= MAX_EN_COLA) return false;

    this.enCola++;
    try {
      const ahora = Date.now();
      const inicio = Math.max(ahora, this.huecoLibreEn);
      this.huecoLibreEn = inicio + ESPACIADO_MS;

      const espera = inicio - ahora;
      if (espera > 0) await new Promise((seguir) => setTimeout(seguir, espera));
      return true;
    } finally {
      this.enCola--;
    }
  }

  private aSugerencia(resultado: ResultadoOsm, tipo: TipoLugar): SugerenciaLugar {
    const direccion = resultado.address ?? {};
    const completo = resultado.display_name ?? '';

    const calle = [direccion.road ?? direccion.pedestrian, direccion.house_number]
      .filter(Boolean)
      .join(' ');
    const principal = (tipo === 'direccion' ? calle : this.poblacion(resultado))
      || completo.split(',')[0]
      || completo;

    const contexto = tipo === 'direccion'
      ? [direccion.postcode, this.poblacion(resultado), direccion.province ?? direccion.state]
      : [direccion.province ?? direccion.state, direccion.country];

    return {
      placeId: this.idDe(resultado),
      descripcion: completo,
      principal,
      secundario: contexto.filter(Boolean).join(', '),
    };
  }

  private idDe(resultado: ResultadoOsm): string {
    const letra = LETRA[resultado.osm_type ?? ''] ?? 'N';
    return `${PREFIJO_OSM}${letra}${resultado.osm_id ?? ''}`;
  }

  private poblacion(resultado: ResultadoOsm): string {
    const direccion = resultado.address ?? {};
    return direccion.city ?? direccion.town ?? direccion.village ?? direccion.municipality ?? '';
  }

  /** Nominatim manda las coordenadas como texto; sin ellas el punto no sirve. */
  private punto(resultado: ResultadoOsm): { lat: number; lng: number } | null {
    const lat = Number(resultado.lat);
    const lng = Number(resultado.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }
}
