import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CrearReviewPayload {
  reservaId: string;
  puntuacion: number;
  comentario: string;
}

export interface ResenaApi {
  _id: string;
  reservaId: string;
  servicioTitulo: string;
  vertical: string;
  puntuacion: number;
  comentario: string;
  respuesta?: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reviews`;

  crear(payload: CrearReviewPayload): Promise<ResenaApi> {
    return firstValueFrom(this.http.post<ResenaApi>(this.base, payload));
  }

  misResenas(usuarioId: string): Promise<ResenaApi[]> {
    return firstValueFrom(this.http.get<ResenaApi[]>(`${this.base}?usuarioId=${usuarioId}`));
  }
}
