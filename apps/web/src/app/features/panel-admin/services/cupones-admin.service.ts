import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Cupon {
  _id?: string;
  codigo: string;
  tipo: 'porcentaje' | 'fijo';
  valor: number;
  vertical: string;
  montoMinimo?: number;
  usoMaximo?: number;
  usados?: number;
  activo?: boolean;
  descripcion?: string;
}

@Injectable({ providedIn: 'root' })
export class CuponesAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cupones`;

  listar(): Promise<Cupon[]> {
    return firstValueFrom(this.http.get<Cupon[]>(this.base));
  }

  crear(cupon: Cupon): Promise<Cupon> {
    return firstValueFrom(this.http.post<Cupon>(this.base, cupon));
  }
}
