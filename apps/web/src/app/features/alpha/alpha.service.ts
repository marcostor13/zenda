import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AlphaNivelApi {
  nivel: number;
  nombre: string;
  reservasRequeridas: number;
  descuentoPct: number;
  beneficios: string[];
}

export interface AlphaEstadoApi {
  nivelActual: number;
  nombreNivel: string;
  descuentoPct: number;
  beneficios: string[];
  reservasCompletadas: number;
  reservasParaSiguiente: number | null;
  siguienteNivel: AlphaNivelApi | null;
  esMaximoNivel: boolean;
}

@Injectable({ providedIn: 'root' })
export class AlphaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/alpha`;

  niveles(): Promise<AlphaNivelApi[]> {
    return firstValueFrom(this.http.get<AlphaNivelApi[]>(`${this.base}/niveles`));
  }

  miEstado(): Promise<AlphaEstadoApi> {
    return firstValueFrom(this.http.get<AlphaEstadoApi>(`${this.base}/mi-estado`));
  }
}
