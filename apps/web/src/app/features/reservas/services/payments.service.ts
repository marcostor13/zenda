import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PaymentIntentResponse {
  clientSecret: string;
  pagoId: string;
  montoTotal: number;
  moneda: string;
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
}
