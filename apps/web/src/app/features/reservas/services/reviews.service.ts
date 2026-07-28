import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CrearReviewPayload {
  reservaId: string;
  puntuacion: number;
  comentario: string;
  aspectos?: Record<string, number>;
  fotos?: string[];
}

export interface ActualizarReviewPayload {
  puntuacion?: number;
  comentario?: string;
  aspectos?: Record<string, number>;
  fotos?: string[];
}

export interface ResenaApi {
  _id: string;
  reservaId: string;
  servicioTitulo: string;
  vertical: string;
  puntuacion: number;
  comentario: string;
  aspectos?: Record<string, number>;
  fotos?: string[];
  eliminada?: boolean;
  respuesta?: string | null;
  createdAt: string;
}

export interface PendienteDeValorarApi {
  reservaId: string;
  servicioId: string;
  servicioTitulo: string;
  vertical: string;
  imagen: string | null;
  fechaInicio: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reviews`;

  crear(payload: CrearReviewPayload): Promise<ResenaApi> {
    return firstValueFrom(this.http.post<ResenaApi>(this.base, payload));
  }

  actualizar(id: string, payload: ActualizarReviewPayload): Promise<ResenaApi> {
    return firstValueFrom(this.http.patch<ResenaApi>(`${this.base}/${id}`, payload));
  }

  eliminar(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  misResenas(usuarioId: string): Promise<ResenaApi[]> {
    return firstValueFrom(this.http.get<ResenaApi[]>(`${this.base}?usuarioId=${usuarioId}`));
  }

  pendientesDeValorar(): Promise<PendienteDeValorarApi[]> {
    return firstValueFrom(this.http.get<PendienteDeValorarApi[]>(`${this.base}/pendientes`));
  }
}
