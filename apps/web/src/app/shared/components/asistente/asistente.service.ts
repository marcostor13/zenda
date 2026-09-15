import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ConsultaAsistenteDto, RespuestaAsistenteApi } from 'shared';
import { environment } from '../../../../environments/environment';

/** Una consulta al asistente de la web. */
@Injectable({ providedIn: 'root' })
export class AsistenteService {
  private readonly http = inject(HttpClient);

  preguntar(consulta: ConsultaAsistenteDto): Promise<RespuestaAsistenteApi> {
    return firstValueFrom(
      this.http.post<RespuestaAsistenteApi>(`${environment.apiUrl}/asistente`, consulta),
    );
  }
}
