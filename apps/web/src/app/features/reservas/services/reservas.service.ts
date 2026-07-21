import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CrearReservaPayload {
  servicioId: string;
  comercioId: string;
  vertical: string;
  perroId?: string;
  fechaInicio: string;
  fechaFin?: string;
  cantidad?: number;
  detalle?: Record<string, unknown>;
  cuponCodigo?: string;
}

export interface SuplementoAplicadoApi {
  concepto: string;
  monto: number;
  motivo?: string;
  evidenciaUrl?: string;
  createdAt: string;
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
  perroSnapshot?: Record<string, unknown>;
  montoSubtotal: number;
  comisionMonto: number;
  descuentoMonto: number;
  montoTotal: number;
  moneda: string;
  cuponCodigo?: string;
  fechaInicio: string;
  fechaFin?: string;
  cantidad: number;
  estado: 'pendiente' | 'confirmada' | 'ajuste_solicitado' | 'cancelada' | 'completada' | 'no_show';
  pagoId?: string;
  suplementos?: SuplementoAplicadoApi[];
  montoAjustado?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecordatorioApi {
  vertical: string;
  icono: string;
  mensaje: string;
  mesesDesde: number;
  ruta: string;
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

  recordatorios(): Promise<RecordatorioApi[]> {
    return firstValueFrom(this.http.get<RecordatorioApi[]>(`${this.base}/recordatorios`));
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
