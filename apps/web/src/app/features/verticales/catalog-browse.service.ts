import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Tarjeta genérica de servicio devuelta por el catálogo (cualquier vertical). */
export interface ServicioCard {
  id: string;
  nombre: string;
  ciudad: string;
  comercioId?: string;
  precioPorNoche: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
  imagenes: string[];
  destacado: boolean;
  vertical?: string;
  /** El comercio ofrece ventajas del programa Doogking Alpha (HU-13.3). */
  alphaAdherido?: boolean;
  /** Punto exacto del negocio; ausente mientras no haya fijado su ubicación. */
  lat?: number;
  lng?: number;
  extra: Record<string, unknown>;
}

/** Reseña real (no fabricada) tal como la ve el usuario en la ficha de detalle. */
export interface ResenaResumen {
  id: string;
  autorNombre: string;
  puntuacion: number;
  comentario: string;
  fecha: string;
  respuesta?: string | null;
  /** Puntuación por criterio (limpieza, trato…) según el vertical. Vacío si no se valoró. */
  aspectos?: Record<string, number>;
  fotos?: string[];
}

/** Ficha completa de un servicio (cualquier vertical) — GET /catalog/servicios/:id. */
export interface ServicioDetalle extends ServicioCard {
  barrio: string;
  direccion: string;
  amenities: string[];
  cancelacionGratis: boolean;
  descripcion: string;
  resenas: ResenaResumen[];
  comercioId: string;
}

export type OrdenServicios = 'relevancia' | 'precio_asc' | 'precio_desc' | 'valoracion' | 'distancia';

export interface OpcionesBusqueda {
  ciudad?: string;
  /** Página pedida (1 = primera). El listado la usa para "Ver más resultados". */
  page?: number;
  /** Resultados por página; por defecto 20. */
  limit?: number;
  /** Filtra por compatibilidad con esta mascota registrada. */
  perroId?: string;
  orden?: OrdenServicios;
  lat?: number;
  lng?: number;
  precioMin?: number;
  precioMax?: number;
  ratingMin?: number;
  amenities?: string[];
  /** Filtros propios del vertical (urgencias, tipo de vehículo…). */
  filtrosVertical?: Record<string, string[] | boolean>;
  /** Recorta la búsqueda a lo que se ve en el mapa; sustituye a `ciudad`. */
  zona?: ZonaBusqueda;
}

export interface ZonaBusqueda {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

/** Pin del mapa: lo mínimo para dibujarlo sin cargar la ficha completa. */
export interface PuntoServicio {
  id: string;
  titulo: string;
  precio: number;
  lat: number;
  lng: number;
  rating: number;
  imagen?: string;
}

/** Facetas del panel de filtros: histograma de precios y contadores. */
export interface FacetasCatalogo {
  precios: Array<{ desde: number; hasta: number; n: number }>;
  amenities: Array<{ valor: string; n: number }>;
  valoracion: Array<{ minimo: number; n: number }>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogBrowseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalog/servicios`;

  async buscar(vertical: string, opciones: OpcionesBusqueda = {}): Promise<ServicioCard[]> {
    return (await this.buscarPaginado(vertical, opciones)).items;
  }

  /** Igual que `buscar`, pero conservando el total para el contador del listado. */
  async buscarPaginado(
    vertical: string, opciones: OpcionesBusqueda = {},
  ): Promise<PaginatedResult<ServicioCard>> {
    const params: Record<string, string> = {
      vertical,
      limit: String(opciones.limit ?? 20),
      ...this.paramsFiltros(opciones),
    };
    if (opciones.page && opciones.page > 1) params['page'] = String(opciones.page);
    if (opciones.orden) params['orden'] = opciones.orden;
    if (opciones.lat != null) params['lat'] = String(opciones.lat);
    if (opciones.lng != null) params['lng'] = String(opciones.lng);

    const res = await firstValueFrom(
      this.http.get<PaginatedResult<ServicioCard>>(this.base, { params }),
    );
    return { ...res, items: (res.items ?? []).map((s) => ({ ...s, extra: s.extra ?? {} })) };
  }

  /**
   * Pines de la zona visible. Van aparte de la lista porque esta se pagina y
   * el mapa debe enseñar todo lo que hay en pantalla.
   */
  puntosMapa(vertical: string, opciones: OpcionesBusqueda = {}): Promise<PuntoServicio[]> {
    const params: Record<string, string> = { vertical, ...this.paramsFiltros(opciones) };
    return firstValueFrom(this.http.get<PuntoServicio[]>(`${this.base}/mapa`, { params }));
  }

  /** Parámetros comunes a la lista y al mapa, para que ambos cuenten lo mismo. */
  private paramsFiltros(opciones: OpcionesBusqueda): Record<string, string> {
    const params: Record<string, string> = {};
    // La zona del mapa manda sobre la ciudad escrita: si el usuario arrastró el
    // mapa, quiere ver lo que hay ahí.
    if (opciones.zona) {
      params['swLat'] = String(opciones.zona.swLat);
      params['swLng'] = String(opciones.zona.swLng);
      params['neLat'] = String(opciones.zona.neLat);
      params['neLng'] = String(opciones.zona.neLng);
    } else if (opciones.ciudad) {
      params['ciudad'] = opciones.ciudad;
    }

    if (opciones.perroId) params['perroId'] = opciones.perroId;
    if (opciones.precioMin) params['precioMin'] = String(opciones.precioMin);
    if (opciones.precioMax) params['precioMax'] = String(opciones.precioMax);
    if (opciones.ratingMin) params['ratingMin'] = String(opciones.ratingMin);
    if (opciones.amenities?.length) params['amenities'] = opciones.amenities.join(',');

    for (const [campo, valor] of Object.entries(opciones.filtrosVertical ?? {})) {
      params[campo] = Array.isArray(valor) ? valor.join(',') : String(valor);
    }
    return params;
  }

  /** Histograma de precios y contadores por opción para el panel de filtros. */
  facetas(vertical: string, ciudad?: string): Promise<FacetasCatalogo> {
    const params: Record<string, string> = { vertical };
    if (ciudad) params['ciudad'] = ciudad;
    return firstValueFrom(this.http.get<FacetasCatalogo>(`${this.base}/facetas`, { params }));
  }

  async obtener(id: string): Promise<ServicioDetalle> {
    const s = await firstValueFrom(this.http.get<ServicioDetalle>(`${this.base}/${id}`));
    return { ...s, extra: s.extra ?? {} };
  }
}
