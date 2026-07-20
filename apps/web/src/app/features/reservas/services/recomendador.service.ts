import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface RecomendacionAdiestramiento {
  tipoRecomendado: 'curso_cachorros' | 'valoracion_previa' | 'individual_o_grupal';
  bloqueaGrupales: boolean;
  mensaje: string;
}

export interface RecomendacionVeterinaria {
  accion: 'reserva_directa' | 'consulta_general' | 'urgencias_inmediatas';
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class RecomendadorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/recomendador`;

  adiestramiento(motivo: string, intensidad: string, edadMeses?: number): Promise<RecomendacionAdiestramiento> {
    return firstValueFrom(
      this.http.post<RecomendacionAdiestramiento>(`${this.base}/adiestramiento`, { motivo, intensidad, edadMeses }),
    );
  }

  veterinaria(motivo: string, gravedad: string, sintomasAsociados?: string[]): Promise<RecomendacionVeterinaria> {
    return firstValueFrom(
      this.http.post<RecomendacionVeterinaria>(`${this.base}/veterinaria`, { motivo, gravedad, sintomasAsociados }),
    );
  }
}
