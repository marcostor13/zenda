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
  /** Filtra por compatibilidad con esta mascota registrada. */
  perroId?: string;
  orden?: OrdenServicios;
  lat?: number;
  lng?: number;
}

interface PaginatedResult<T> {
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
    const params: Record<string, string> = { vertical, limit: '20' };
    if (opciones.ciudad) params['ciudad'] = opciones.ciudad;
    if (opciones.perroId) params['perroId'] = opciones.perroId;
    if (opciones.orden) params['orden'] = opciones.orden;
    if (opciones.lat != null) params['lat'] = String(opciones.lat);
    if (opciones.lng != null) params['lng'] = String(opciones.lng);

    const res = await firstValueFrom(
      this.http.get<PaginatedResult<ServicioCard>>(this.base, { params }),
    );
    return res.items.map((s) => ({ ...s, extra: s.extra ?? {} }));
  }

  async obtener(id: string): Promise<ServicioDetalle> {
    const s = await firstValueFrom(this.http.get<ServicioDetalle>(`${this.base}/${id}`));
    return { ...s, extra: s.extra ?? {} };
  }
}
