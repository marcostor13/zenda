import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  BusquedaTransportesRespuesta, OrdenTransporte, SolicitudPresupuestoVista, SolicitudTransporte,
  UbicacionViajeRespuesta, VerticalKey,
} from 'shared';
import { environment } from '../../../../environments/environment';
import { ReservaApi } from '../../reservas/services/reservas.service';

export interface VistaPreviaCancelacion {
  porcentaje: number;
  importe: number;
  motivo: string;
}

export interface ContactoReserva {
  nombre: string;
  telefono?: string;
  whatsapp?: string;
}

/**
 * Llamadas del flujo de Transporte y de lo que cuelga de una reserva en marcha
 * (cancelación con política, contacto, ubicación en vivo, presupuestos).
 */
@Injectable({ providedIn: 'root' })
export class TransporteViajeApi {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  buscar(solicitud: SolicitudTransporte, orden: OrdenTransporte): Promise<BusquedaTransportesRespuesta> {
    return firstValueFrom(
      this.http.post<BusquedaTransportesRespuesta>(`${this.api}/transporte/cotizaciones`, { solicitud, orden }),
    );
  }

  cotizarEmpresa(servicioId: string, solicitud: SolicitudTransporte): Promise<BusquedaTransportesRespuesta> {
    return firstValueFrom(
      this.http.post<BusquedaTransportesRespuesta>(`${this.api}/transporte/cotizaciones/${servicioId}`, solicitud),
    );
  }

  pedirPresupuesto(params: {
    servicioIds: string[];
    solicitud: SolicitudTransporte;
    resumen: Array<[string, string]>;
    comentario?: string;
  }): Promise<SolicitudPresupuestoVista> {
    return firstValueFrom(this.http.post<SolicitudPresupuestoVista>(`${this.api}/presupuestos`, {
      vertical: VerticalKey.TRANSPORTE,
      servicioIds: params.servicioIds,
      detalle: { solicitud: params.solicitud, resumen: params.resumen },
      fechaServicio: params.solicitud.fecha,
      comentario: params.comentario,
    }));
  }

  misPresupuestos(): Promise<SolicitudPresupuestoVista[]> {
    return firstValueFrom(this.http.get<SolicitudPresupuestoVista[]>(`${this.api}/presupuestos/mis`));
  }

  presupuesto(id: string): Promise<SolicitudPresupuestoVista> {
    return firstValueFrom(this.http.get<SolicitudPresupuestoVista>(`${this.api}/presupuestos/${id}`));
  }

  cancelarPresupuesto(id: string): Promise<SolicitudPresupuestoVista> {
    return firstValueFrom(this.http.post<SolicitudPresupuestoVista>(`${this.api}/presupuestos/${id}/cancelar`, {}));
  }

  vistaPreviaCancelacion(reservaId: string): Promise<VistaPreviaCancelacion> {
    return firstValueFrom(this.http.get<VistaPreviaCancelacion>(`${this.api}/reservas/${reservaId}/cancelacion`));
  }

  cancelar(reservaId: string): Promise<ReservaApi> {
    return firstValueFrom(this.http.post<ReservaApi>(`${this.api}/reservas/${reservaId}/cancelacion`, {}));
  }

  contacto(reservaId: string): Promise<ContactoReserva> {
    return firstValueFrom(this.http.get<ContactoReserva>(`${this.api}/reservas/${reservaId}/contacto`));
  }

  ubicacion(reservaId: string): Promise<UbicacionViajeRespuesta> {
    return firstValueFrom(this.http.get<UbicacionViajeRespuesta>(`${this.api}/reservas/${reservaId}/ubicacion`));
  }
}
