import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface FiltrosHotel {
  ciudad?: string;
  desde?: string;
  hasta?: string;
  huespedes?: number;
  precioMin?: number;
  precioMax?: number;
  estrellas?: number[];
  amenities?: string[];
  cancelacionGratis?: boolean;
  page?: number;
  limit?: number;
}

export interface HotelCard {
  id: string;
  nombre: string;
  ciudad: string;
  barrio: string;
  direccion: string;
  estrellas: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
  precioPorNoche: number;
  precioAnterior?: number;
  descuentoPct?: number;
  imagenes: string[];
  amenities: string[];
  cancelacionGratis: boolean;
  desayunoIncluido: boolean;
  habitacionesDisponibles: number;
  destacado: boolean;
  lat?: number;
  lng?: number;
}

export interface HotelDetalle extends HotelCard {
  descripcion: string;
  politicaCancelacion: string;
  checkIn: string;
  checkOut: string;
  habitaciones: Habitacion[];
  resenas: Resena[];
  scoreDesglose: ScoreDesglose;
  reglas: string[];
  idiomas: string[];
  comercioId: string;
}

export interface Habitacion {
  id: string;
  tipo: string;
  descripcion: string;
  capacidad: number;
  camas: string;
  tamano: number;
  precio: number;
  precioAnterior?: number;
  amenities: string[];
  imagenes: string[];
  disponible: boolean;
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
  tipoViaje: string;
  desglose: ScoreDesglose;
  respuestaComercio?: string;
}

export interface ScoreDesglose {
  limpieza: number;
  ubicacion: number;
  servicios: number;
  valorPrecio: number;
  confort: number;
  personal: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class HotelesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalog/servicios`;

  async buscar(filtros: FiltrosHotel): Promise<PaginatedResult<HotelCard>> {
    const params: Record<string, string> = { vertical: 'hoteles' };
    if (filtros.ciudad)   params['ciudad'] = filtros.ciudad;
    if (filtros.desde)    params['desde']  = filtros.desde;
    if (filtros.hasta)    params['hasta']  = filtros.hasta;
    if (filtros.precioMin) params['precioMin'] = String(filtros.precioMin);
    if (filtros.precioMax) params['precioMax'] = String(filtros.precioMax);
    if (filtros.page)  params['page']  = String(filtros.page);
    if (filtros.limit) params['limit'] = String(filtros.limit);

    return firstValueFrom(this.http.get<PaginatedResult<HotelCard>>(this.base, { params }));
  }

  async obtener(id: string): Promise<HotelDetalle> {
    return firstValueFrom(this.http.get<HotelDetalle>(`${this.base}/${id}`));
  }
}
