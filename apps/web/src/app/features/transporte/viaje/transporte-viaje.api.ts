import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  BusquedaTransportesRespuesta, OrdenTransporte, PresupuestoDto, SolicitudViaje, UbicacionViajeRespuesta,
  instanteDeRecogida,
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

  buscar(solicitud: SolicitudViaje, orden: OrdenTransporte): Promise<BusquedaTransportesRespuesta> {
    return firstValueFrom(
      this.http.post<BusquedaTransportesRespuesta>(`${this.api}/transporte/cotizaciones`, { solicitud, orden }),
    );
  }

  cotizarEmpresa(servicioId: string, solicitud: SolicitudViaje): Promise<BusquedaTransportesRespuesta> {
    return firstValueFrom(
      this.http.post<BusquedaTransportesRespuesta>(`${this.api}/transporte/cotizaciones/${servicioId}`, solicitud),
    );
  }

  /**
   * Pide presupuesto a cada empresa con el viaje ya descrito: el cliente no
   * rellena nada más. El API guarda una petición por empresa.
   */
  async pedirPresupuesto(params: {
    servicioIds: string[];
    solicitud: SolicitudViaje;
    resumen: Array<[string, string]>;
  }): Promise<PresupuestoDto[]> {
    const perroId = params.solicitud.mascotas.find((m) => m.perroId)?.perroId;
    return Promise.all(params.servicioIds.map((servicioId) => firstValueFrom(
      this.http.post<PresupuestoDto>(`${this.api}/presupuestos`, {
        servicioId,
        perroId,
        fechaServicio: instanteDeRecogida(params.solicitud).toISOString(),
        solicitud: { solicitud: params.solicitud, resumen: params.resumen },
      }),
    )));
  }

  misPresupuestos(): Promise<PresupuestoDto[]> {
    return firstValueFrom(this.http.get<PresupuestoDto[]>(`${this.api}/presupuestos/mis`));
  }

  /** Acepta la oferta: el API crea la reserva, pendiente de pago, con el importe pactado. */
  aceptarPresupuesto(id: string, detalleExtra?: Record<string, unknown>): Promise<PresupuestoDto> {
    return firstValueFrom(this.http.post<PresupuestoDto>(`${this.api}/presupuestos/${id}/aceptar`, { detalleExtra }));
  }

  rechazarPresupuesto(id: string, motivo?: string): Promise<PresupuestoDto> {
    return firstValueFrom(this.http.post<PresupuestoDto>(`${this.api}/presupuestos/${id}/rechazar`, { motivo }));
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
