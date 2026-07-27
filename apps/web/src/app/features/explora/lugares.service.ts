import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CrearLugarDto, CrearLugarReviewDto, TipoLugar } from 'shared';
import { environment } from '../../../environments/environment';

export interface LugarApi {
  _id: string;
  tipo: TipoLugar;
  nombre: string;
  descripcion: string;
  fotos: string[];
  ubicacion: {
    ciudad: string;
    provincia?: string;
    direccion?: string;
    geo?: { type: 'Point'; coordinates: [number, number] };
  };
  atributos: Record<string, unknown>;
  ratingPromedio: number;
  totalReviews: number;
}

export interface LugarReviewApi {
  _id: string;
  usuarioNombre: string;
  puntuacion: number;
  texto: string;
  fotos: string[];
  esIncidencia: boolean;
  createdAt: string;
}

export interface FiltrosLugares {
  tipo?: TipoLugar;
  ciudad?: string;
  provincia?: string;
  lat?: number;
  lng?: number;
  radioKm?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class LugaresService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/lugares`;

  buscar(filtros: FiltrosLugares = {}): Promise<LugarApi[]> {
    const params: Record<string, string> = {};
    if (filtros.tipo) params['tipo'] = filtros.tipo;
    if (filtros.ciudad) params['ciudad'] = filtros.ciudad;
    if (filtros.provincia) params['provincia'] = filtros.provincia;
    if (filtros.lat != null) params['lat'] = String(filtros.lat);
    if (filtros.lng != null) params['lng'] = String(filtros.lng);
    if (filtros.radioKm != null) params['radioKm'] = String(filtros.radioKm);
    if (filtros.limit != null) params['limit'] = String(filtros.limit);

    return firstValueFrom(this.http.get<LugarApi[]>(this.base, { params }));
  }

  obtener(id: string): Promise<LugarApi> {
    return firstValueFrom(this.http.get<LugarApi>(`${this.base}/${id}`));
  }

  reviews(id: string): Promise<LugarReviewApi[]> {
    return firstValueFrom(this.http.get<LugarReviewApi[]>(`${this.base}/${id}/reviews`));
  }

  proponer(dto: CrearLugarDto): Promise<LugarApi> {
    return firstValueFrom(this.http.post<LugarApi>(this.base, dto));
  }

  aportar(id: string, dto: CrearLugarReviewDto): Promise<LugarReviewApi> {
    return firstValueFrom(this.http.post<LugarReviewApi>(`${this.base}/${id}/reviews`, dto));
  }
}
