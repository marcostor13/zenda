import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ServicioCard {
  id: string;
  nombre: string;
  ciudad: string;
  precioPorNoche: number; // precioBase del servicio (tarifa base para taxis)
  score: number;
  scoreLabel: string;
  numResenas: number;
  imagenes: string[];
  destacado: boolean;
  vertical?: string;
  extra?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface TaxiCard {
  id: string;
  nombre: string;
  ciudad: string;
  imagen: string;
  comercioId: string;
  tipoVehiculo: string;
  capacidad: number;
  tarifaBase: number;
  tarifaKm: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
}

@Injectable({ providedIn: 'root' })
export class TaxisService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalog/servicios`;

  async buscar(ciudad?: string): Promise<TaxiCard[]> {
    const params: Record<string, string> = { vertical: 'taxis', limit: '20' };
    if (ciudad) params['ciudad'] = ciudad;
    const res = await firstValueFrom(
      this.http.get<PaginatedResult<ServicioCard>>(this.base, { params }),
    );
    return res.items.map((s) => this.toTaxi(s));
  }

  private toTaxi(s: ServicioCard): TaxiCard {
    const e = s.extra ?? {};
    return {
      id: s.id,
      nombre: s.nombre,
      ciudad: s.ciudad,
      imagen: s.imagenes?.[0] ?? '',
      comercioId: '',
      tipoVehiculo: (e['tipoVehiculo'] as string) ?? 'sedan',
      capacidad: (e['capacidad'] as number) ?? 4,
      tarifaBase: (e['tarifaBase'] as number) ?? s.precioPorNoche,
      tarifaKm: (e['tarifaKm'] as number) ?? 0,
      score: s.score,
      scoreLabel: s.scoreLabel,
      numResenas: s.numResenas,
    };
  }
}
