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
  topeDescuento?: number;
  usoMaximo?: number;
  usados?: number;
  activo?: boolean;
  descripcion?: string;
  /** Fin de la validez; sin valor, el cupón no caduca (TCK-8037). */
  validoHasta?: string;
  /** Quién asume el descuento; por defecto, la plataforma (TCK-8037). */
  asumeDescuento?: 'plataforma' | 'comercio';
  /** Sólo para clientes que aún no han reservado (TCK-8037). */
  soloPrimeraReserva?: boolean;
  /** Usos por persona; 0 = sin límite individual (TCK-8037 §6). */
  usosPorUsuario?: number;
  /** Alcance: comercio o ciudad concretos (TCK-8037 §5). */
  comercioId?: string;
  ciudad?: string;
  /** Nivel Alpha mínimo; 0 = cualquiera (TCK-8037 §4). */
  nivelAlphaMinimo?: number;
  /** Campaña a la que pertenece el cupón (TCK-8038 §5). */
  campanaId?: string;
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
