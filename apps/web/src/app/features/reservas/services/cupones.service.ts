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

  /** Valida un cupón y devuelve el descuento; lanza si no es aplicable. */
  validar(codigo: string, vertical: string, montoSubtotal: number): Promise<DescuentoAplicado> {
    return firstValueFrom(
      this.http.post<DescuentoAplicado>(`${this.base}/validar`, { codigo, vertical, montoSubtotal }),
    );
  }
}
