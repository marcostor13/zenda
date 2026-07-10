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
  lat?: number;
  lng?: number;
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
  scoreDesglose: ScoreDesglose;
  reglas: string[];
  comercioId: string;
}

export type TipoEspacio = 'suite' | 'estandar' | 'compartido';
export type TamanoPerro = 'pequeno' | 'mediano' | 'grande' | 'gigante';

export interface Espacio {
  id: string;
  tipo: TipoEspacio;
  descripcion: string;
  tamanoMaxPerro: TamanoPerro;
  precioNoche: number;
  precioAnterior?: number;
  cantidad: number;
  disponible: boolean;
  amenities: string[];
  imagenes: string[];
  cancelacionGratis: boolean;
}

export interface Resena {
  id: string;
  autorNombre: string;
  autorAvatar: string;
  fecha: string;
  score: number;
  titulo: string;
  texto: string;
  pais: string;
  tamanoPerro: string;
  desglose: ScoreDesglose;
  respuestaComercio?: string;
}

export interface ScoreDesglose {
  limpieza: number;
  ubicacion: number;
  cuidado: number;
  valorPrecio: number;
  instalaciones: number;
  personal: number;
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

    return firstValueFrom(this.http.get<PaginatedResult<AlojamientoCard>>(this.base, { params }));
  }

  async obtener(id: string): Promise<AlojamientoDetalle> {
    return firstValueFrom(this.http.get<AlojamientoDetalle>(`${this.base}/${id}`));
  }
}
