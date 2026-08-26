import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { CalendarioDisponibilidadRespuestaApi } from 'shared';
import { environment } from '../../../../environments/environment';

export interface RecurrenciaPayload {
  diasSemana: number[];
  hora: string;
  fechaFin: string;
}

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
  /** Trayectos recurrentes (Ref. TRA3): genera reservas hijas para cada ocurrencia. */
  recurrencia?: RecurrenciaPayload;
}

/** Consulta de disponibilidad: los mismos datos de la reserva menos cupón y recurrencia. */
export type ComprobarDisponibilidadPayload = Omit<CrearReservaPayload, 'cuponCodigo' | 'recurrencia'>;

export interface DisponibilidadApi {
  disponible: boolean;
  /** Por qué no se puede reservar; sólo cuando `disponible` es false. */
  motivo?: string;
  precioEstimado?: number;
  capacidadRestante?: number;
}

export interface ConsultaCalendario {
  servicioId: string;
  /** `YYYY-MM-DD`, ambos inclusive. */
  desde: string;
  hasta: string;
  espacioId?: string;
}

export type CalendarioApi = CalendarioDisponibilidadRespuestaApi;

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
  seguimiento?: Array<{ hito: string; nota?: string; at: string }>;
  montoSubtotal: number;
  comisionMonto: number;
  descuentoMonto: number;
  montoTotal: number;
  moneda: string;
  cuponCodigo?: string;
  fechaInicio: string;
  fechaFin?: string;
  cantidad: number;
  estado: 'pendiente' | 'confirmada' | 'ajuste_solicitado' | 'en_curso' | 'cancelada' | 'completada' | 'no_show' | 'pago_retenido' | 'pago_liberado' | 'en_disputa' | 'reembolsada';
  pagoId?: string;
  suplementos?: SuplementoAplicadoApi[];
  montoAjustado?: number;
  /** Título del servicio, cuando el API lo adjunta para el listado. */
  servicioTitulo?: string;
  /** Viaje multi-vertical: reserva principal a la que está vinculada. */
  reservaMadreId?: string;
  carritoId?: string;
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

export interface PuntosApi {
  puntos: number;
  proximoUmbral: number;
  puntosFaltantes: number;
  valorProximoDescuento: number;
}

/** Próxima reserva confirmada del usuario (HU-7.3), sin campos inventados. */
export interface ProximaReservaApi {
  codigo: string;
  titulo: string;
  imagen: string;
  ciudad: string;
  fechaInicio: string;
  vertical: string;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/reservas`;

  crear(payload: CrearReservaPayload): Promise<ReservaApi> {
    return firstValueFrom(this.http.post<ReservaApi>(this.base, payload));
  }

  /**
   * Pregunta si el servicio admite estas fechas/datos antes de crear nada.
   * Se usa en el primer paso del wizard para no dejar avanzar hacia el pago
   * una reserva que el API va a rechazar al final.
   */
  comprobarDisponibilidad(payload: ComprobarDisponibilidadPayload): Promise<DisponibilidadApi> {
    return firstValueFrom(
      this.http.post<DisponibilidadApi>(`${this.base}/disponibilidad`, payload),
    );
  }

  /**
   * Días reservables de un servicio en un rango, para pintar el calendario.
   * `soportado: false` = este vertical no se reserva por rango de fechas.
   */
  calendario(consulta: ConsultaCalendario): Promise<CalendarioApi> {
    const params: Record<string, string> = {
      servicioId: consulta.servicioId, desde: consulta.desde, hasta: consulta.hasta,
      ...(consulta.espacioId ? { espacioId: consulta.espacioId } : {}),
    };
    return firstValueFrom(
      this.http.get<CalendarioApi>(`${this.base}/disponibilidad/calendario`, { params }),
    );
  }

  misReservas(): Promise<ReservaApi[]> {
    return firstValueFrom(this.http.get<ReservaApi[]>(`${this.base}/mis`));
  }

  recordatorios(): Promise<RecordatorioApi[]> {
    return firstValueFrom(this.http.get<RecordatorioApi[]>(`${this.base}/recordatorios`));
  }

  puntos(): Promise<PuntosApi> {
    return firstValueFrom(this.http.get<PuntosApi>(`${this.base}/puntos`));
  }

  proximaReserva(): Promise<ProximaReservaApi | null> {
    return firstValueFrom(this.http.get<ProximaReservaApi | null>(`${this.base}/proxima`));
  }

  /** Todas las reservas de un mismo viaje, en orden cronológico (HU-037). */
  viaje(reservaMadreId: string): Promise<ReservaApi[]> {
    return firstValueFrom(this.http.get<ReservaApi[]>(`${this.base}/viaje/${reservaMadreId}`));
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

  /** Abre una incidencia sobre una reserva propia (TCK-8040 §2). */
  async abrirIncidencia(payload: { reservaId: string; tipo: string; asunto: string; descripcion: string }): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiUrl}/incidencias`, payload));
  }
}
