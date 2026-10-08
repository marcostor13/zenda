import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DescuentoAplicado {
  codigo: string;
  tipo: string;
  descuento: number;
  descripcion?: string;
}

@Injectable({ providedIn: 'root' })
export class CuponesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cupones`;

  /**
   * Valida un cupón y devuelve el descuento; lanza si no es aplicable.
   *
   * Con `servicioId` el API puede decir ya si el cupón es de otro comercio o de
   * otra ciudad, en lugar de rechazarlo al confirmar la reserva.
   */
  validar(datos: {
    codigo: string;
    vertical: string;
    montoSubtotal: number;
    servicioId?: string;
  }): Promise<DescuentoAplicado> {
    return firstValueFrom(this.http.post<DescuentoAplicado>(`${this.base}/validar`, datos));
  }
}
