import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { VerticalKey } from 'shared';
import { environment } from '../../../../environments/environment';

export interface FiltrosAlojamiento {
  ciudad?: string;
  desde?: string;
  hasta?: string;
  perros?: number;
  precioMin?: number;
  precioMax?: number;
  ratingMin?: number;
  amenities?: string[];
  cancelacionGratis?: boolean;
  page?: number;
  limit?: number;
  /** Filtra solo servicios aptos para este perro (motor de compatibilidad). */
  perroId?: string;
  /** Criterio de ordenación; `distancia` requiere `lat` y `lng`. */
  orden?: OrdenServicios;
  lat?: number;
  lng?: number;
}

export type OrdenServicios = 'relevancia' | 'precio_asc' | 'precio_desc' | 'valoracion' | 'distancia';

/**
 * Facetas del panel de filtros (PDF 27/07 §3): histograma de precios para el
 * slider y contadores por opción, como en la referencia de Booking.
 */
export interface FacetasCatalogo {
  precios: Array<{ desde: number; hasta: number; n: number }>;
  amenities: Array<{ valor: string; n: number }>;
  valoracion: Array<{ minimo: number; n: number }>;
}

export interface AlojamientoCard {
  id: string;
  nombre: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  score: number;
  scoreLabel: string;
  numResenas: number;
  precioPorNoche: number;
  precioAnterior?: number;
  descuentoPct?: number;
  imagenes: string[];
  amenities: string[];
  descripcion?: string;
  cancelacionGratis: boolean;
  paseosIncluidos: boolean;
  espaciosDisponibles: number;
  destacado: boolean;
  /** El comercio ofrece ventajas del programa Doogking Alpha (HU-13.3). */
  alphaAdherido?: boolean;
  lat?: number;
  lng?: number;
}

export interface ServicioAdicionalAlojamiento {
  nombre: string;
  precio: number;
}

export interface AlojamientoDetalle extends AlojamientoCard {
  descripcion: string;
  politicaCancelacion: string;
  checkIn: string;
  checkOut: string;
  requisitoVacunas: boolean;
  camaras24h: boolean;
  espacios: Espacio[];
  resenas: Resena[];
  /** El API aún no calcula un desglose por categoría; puede no venir. */
  /** El API aún no modela reglas de la casa; puede no venir. */
  reglas?: string[];
  comercioId: string;
  /** Residencia canina (Fase C): perfiles de compatibilidad social admitidos; vacío = cualquiera. */
  compatibilidadSocialAdmitida: string[];
  requisitoMicrochip: boolean;
  requiereDesparasitacionInterna: boolean;
  requiereDesparasitacionExterna: boolean;
  requiereVacunaTosPerreras: boolean;
  serviciosAdicionales: ServicioAdicionalAlojamiento[];
}

export type TipoEspacio = 'suite' | 'estandar' | 'compartido' | 'premium' | 'climatizada';
export type TamanoPerro = 'mini' | 'pequeno' | 'mediano' | 'grande' | 'gigante';

export interface Espacio {
  id: string;
  tipo: TipoEspacio;
  descripcion: string;
  /** Opcional: algunas residencias no diferencian por tamaño. */
  tamanoMaxPerro?: TamanoPerro;
  precioNoche: number;
  precioAnterior?: number;
  cantidad: number;
  disponible: boolean;
  amenities: string[];
  imagenes: string[];
  cancelacionGratis: boolean;
}

/** Reseña real de un servicio (los campos reflejan exactamente lo que guarda el módulo de reviews). */
export interface Resena {
  id: string;
  autorNombre: string;
  puntuacion: number;
  comentario: string;
  fecha: string;
  respuesta?: string | null;
  /** Puntuación por criterio (limpieza, atención…). Vacío si el autor no puntuó por aspectos. */
  aspectos?: Record<string, number>;
  fotos?: string[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class AlojamientoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalog/servicios`;

  async buscar(filtros: FiltrosAlojamiento): Promise<PaginatedResult<AlojamientoCard>> {
    const params: Record<string, string> = { vertical: VerticalKey.ALOJAMIENTO };
    if (filtros.ciudad)   params['ciudad'] = filtros.ciudad;
    if (filtros.desde)    params['desde']  = filtros.desde;
    if (filtros.hasta)    params['hasta']  = filtros.hasta;
    if (filtros.precioMin) params['precioMin'] = String(filtros.precioMin);
    if (filtros.precioMax) params['precioMax'] = String(filtros.precioMax);
    if (filtros.page)  params['page']  = String(filtros.page);
    if (filtros.limit) params['limit'] = String(filtros.limit);
    if (filtros.perroId) params['perroId'] = filtros.perroId;
    if (filtros.orden) params['orden'] = filtros.orden;
    if (filtros.lat != null) params['lat'] = String(filtros.lat);
    if (filtros.lng != null) params['lng'] = String(filtros.lng);

    const res = await firstValueFrom(
      this.http.get<PaginatedResult<AlojamientoCard>>(this.base, { params }),
    );
    return { ...res, items: (res.items ?? []).map((c) => this.normalizarCard(c)) };
  }

  async obtener(id: string): Promise<AlojamientoDetalle> {
    const data = await firstValueFrom(this.http.get<AlojamientoDetalle>(`${this.base}/${id}`));
    return this.normalizarDetalle(data);
  }

  /**
   * Facetas del panel de filtros (PDF 27/07 §3). No dependen del rango de
   * precio elegido, así que basta con recargarlas al cambiar de ciudad.
   */
  facetas(ciudad?: string): Promise<FacetasCatalogo> {
    const params: Record<string, string> = { vertical: VerticalKey.ALOJAMIENTO };
    if (ciudad) params['ciudad'] = ciudad;
    return firstValueFrom(this.http.get<FacetasCatalogo>(`${this.base}/facetas`, { params }));
  }

  /** Garantiza que los arrays existan para que las plantillas no rompan con datos parciales del API. */
  private normalizarCard<T extends AlojamientoCard>(card: T): T {
    return { ...card, imagenes: card.imagenes ?? [], amenities: card.amenities ?? [] };
  }

  private normalizarDetalle(data: AlojamientoDetalle): AlojamientoDetalle {
    return {
      ...this.normalizarCard(data),
      espacios: (data.espacios ?? []).map((esp) => ({
        ...esp,
        imagenes: esp.imagenes ?? [],
        amenities: esp.amenities ?? [],
      })),
      resenas: data.resenas ?? [],
      serviciosAdicionales: data.serviciosAdicionales ?? [],
      compatibilidadSocialAdmitida: data.compatibilidadSocialAdmitida ?? [],
      reglas: data.reglas ?? [],
    };
  }
}
