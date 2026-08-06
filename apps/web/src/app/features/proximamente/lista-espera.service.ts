import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SuscripcionListaEsperaDto } from 'shared';
import { environment } from '../../../environments/environment';

/**
 * Alta en la lista de espera del prelanzamiento. Es la única llamada al API que
 * hace la pantalla "muy pronto", por eso vive junto a ella y no en `core/`.
 */
@Injectable({ providedIn: 'root' })
export class ListaEsperaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/lista-espera`;

  suscribir(email: string, origen = 'proximamente'): Observable<SuscripcionListaEsperaDto> {
    return this.http.post<SuscripcionListaEsperaDto>(this.url, { email, origen });
  }
}
