import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Lo que el entorno permite hacer. Lo decide el API, no el build del cliente. */
export interface ConfiguracionPagos {
  /** true = se puede confirmar una reserva sin cobrar (entornos de prueba). */
  bypassPagoHabilitado: boolean;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  pagoId: string;
  montoTotal: number;
  moneda: string;
}

export interface EstadoPago {
  estado: 'aprobado' | 'pendiente' | 'rechazado';
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/payments`;

  /** Crea (o recupera) el PaymentIntent de Stripe para una reserva. */
  crearIntent(reservaId: string): Promise<PaymentIntentResponse> {
    return firstValueFrom(
      this.http.post<PaymentIntentResponse>(`${this.base}/intent`, { reservaId }),
    );
  }

  /**
   * Pregunta al servidor cómo quedó el cobro tras volver de la pasarela.
   *
   * Se llama nada más confirmar el pago en el navegador. El servidor consulta a
   * Stripe y confirma la reserva si procede: sin esto hay que esperar al
   * webhook, que puede tardar y que en local no llega nunca, y la reserva se
   * queda en "pendiente de pago" con el dinero ya cobrado.
   */
  sincronizar(pagoId: string): Promise<EstadoPago> {
    return firstValueFrom(
      this.http.post<EstadoPago>(`${this.base}/${pagoId}/sincronizar`, {}),
    );
  }

  /** El cliente acepta el ajuste de precio propuesto: crea el PaymentIntent de la diferencia. */
  aceptarAjuste(reservaId: string): Promise<PaymentIntentResponse> {
    return firstValueFrom(
      this.http.post<PaymentIntentResponse>(`${this.base}/reservas/${reservaId}/ajuste/aceptar`, {}),
    );
  }

  /** El cliente rechaza el ajuste: reembolsa el pago original y cancela la reserva. */
  rechazarAjuste(reservaId: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean }>(`${this.base}/reservas/${reservaId}/ajuste/rechazar`, {}),
    );
  }

  /**
   * Qué permite el entorno.
   *
   * Se pregunta al servidor en lugar de deducirlo del build: quien decide si se
   * puede omitir el pago es el API, y si el cliente lo adivinara por su cuenta
   * el botón saldría donde no funciona.
   */
  configuracion(): Promise<ConfiguracionPagos> {
    return firstValueFrom(
      this.http.get<ConfiguracionPagos>(`${this.base}/configuracion`),
    );
  }

  /**
   * Da la reserva por pagada sin cobrar, para recorrer el flujo en pruebas.
   * El servidor responde 403 si el entorno no lo permite.
   */
  confirmarSinCobro(reservaId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.base}/reservas/${reservaId}/confirmar-sin-cobro`, {}),
    );
  }
}
