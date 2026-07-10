import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { VerticalKey } from 'shared';
import { environment } from '../../../../environments/environment';

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
  extra?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export type TipoVehiculoTransporte = 'van_acondicionada' | 'coche' | 'furgon_climatizado';

export interface TransporteCard {
  id: string;
  nombre: string;
  ciudad: string;
  imagen: string;
  comercioId: string;
  tipoVehiculo: TipoVehiculoTransporte;
  capacidadPerros: number;
  zonaCobertura: string[];
  tarifaBase: number;
  tarifaKm: number;
  jaulasIncluidas: boolean;
  acompananteHumano: boolean;
  destacado: boolean;
  score: number;
  scoreLabel: string;
  numResenas: number;
}

@Injectable({ providedIn: 'root' })
export class TransporteService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/catalog/servicios`;

  async buscar(ciudad?: string): Promise<TransporteCard[]> {
    const params: Record<string, string> = { vertical: VerticalKey.TRANSPORTE, limit: '20' };
    if (ciudad) params['ciudad'] = ciudad;
    const res = await firstValueFrom(
      this.http.get<PaginatedResult<ServicioCard>>(this.base, { params }),
    );
    return res.items.map((s) => this.toTransporte(s));
  }

  private toTransporte(s: ServicioCard): TransporteCard {
    const e = s.extra ?? {};
    return {
      id: s.id,
      nombre: s.nombre,
      ciudad: s.ciudad,
      imagen: s.imagenes?.[0] ?? '',
      comercioId: s.comercioId ?? '',
      tipoVehiculo: (e['tipoVehiculo'] as TipoVehiculoTransporte) ?? 'coche',
      capacidadPerros: (e['capacidadPerros'] as number) ?? 1,
      zonaCobertura: (e['zonaCobertura'] as string[]) ?? [],
      tarifaBase: (e['tarifaBase'] as number) ?? s.precioPorNoche,
      tarifaKm: (e['tarifaKm'] as number) ?? 0,
      jaulasIncluidas: (e['jaulasIncluidas'] as boolean) ?? false,
      acompananteHumano: (e['acompananteHumano'] as boolean) ?? false,
      destacado: s.destacado,
      score: s.score,
      scoreLabel: s.scoreLabel,
      numResenas: s.numResenas,
    };
  }
}
