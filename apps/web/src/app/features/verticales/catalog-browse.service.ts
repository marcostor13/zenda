import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Tarjeta genérica de servicio devuelta por el catálogo (cualquier vertical). */
export interface ServicioCard {
  id: string;
  nombre: string;
  ciudad: string;
  precioPorNoche: number;
  score: number;
  scoreLabel: string;
  numResenas: number;
  imagenes: string[];
  destacado: boolean;
  vertical?: string;
  extra: Record<string, unknown>;
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

  async buscar(vertical: string, ciudad?: string): Promise<ServicioCard[]> {
    const params: Record<string, string> = { vertical, limit: '20' };
    if (ciudad) params['ciudad'] = ciudad;
    const res = await firstValueFrom(
      this.http.get<PaginatedResult<ServicioCard>>(this.base, { params }),
    );
    return res.items.map((s) => ({ ...s, extra: s.extra ?? {} }));
  }
}
