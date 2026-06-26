import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CrearReservaPayload {
  servicioId: string;
  comercioId: string;
  vertical: string;
  fechaInicio: string;
  fechaFin?: string;
  cantidad?: number;
  detalle?: Record<string, unknown>;
  cuponCodigo?: string;
}

/** Reserva tal como la devuelve el API (documento crudo). */
export interface ReservaApi {
  _id?: string;
  id?: string;
  codigo: string;
  vertical: string;
  servicioId: string;
  comercioId: string;
  detalle?: Record<string, unknown>;
  montoSubtotal: number;
  comisionMonto: number;
  descuentoMonto: number;
  montoTotal: number;
  moneda: string;
  cuponCodigo?: string;
  fechaInicio: string;
  fechaFin?: string;
  cantidad: number;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada' | 'no_show';
  pagoId?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reservas`;

  crear(payload: CrearReservaPayload): Promise<ReservaApi> {
    return firstValueFrom(this.http.post<ReservaApi>(this.base, payload));
  }

  misReservas(): Promise<ReservaApi[]> {
    return firstValueFrom(this.http.get<ReservaApi[]>(`${this.base}/mis`));
  }

  obtener(id: string): Promise<ReservaApi> {
    return firstValueFrom(this.http.get<ReservaApi>(`${this.base}/${id}`));
  }

  obtenerPorCodigo(codigo: string): Promise<ReservaApi> {
    return firstValueFrom(this.http.get<ReservaApi>(`${this.base}/codigo/${codigo}`));
  }

  cancelar(id: string): Promise<ReservaApi> {
    return firstValueFrom(this.http.post<ReservaApi>(`${this.base}/${id}/cancelar`, {}));
  }
}
