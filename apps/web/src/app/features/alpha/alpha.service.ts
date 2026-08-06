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

/** Negocio adherido al programa Alpha, tal como lo pinta el carrusel del perfil. */
export interface AlphaVentajaApi {
  id: string;
  nombre: string;
  ciudad: string;
  vertical: string;
  imagenes: string[];
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

  /** Negocios adheridos al programa Alpha, para el carrusel de ventajas (HU-13.3). */
  ventajas(): Promise<AlphaVentajaApi[]> {
    return firstValueFrom(this.http.get<AlphaVentajaApi[]>(`${this.base}/ventajas`));
  }
}
