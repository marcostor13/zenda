import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Identificadores públicos con los que se dibujan los botones sociales. */
export interface ConfigSocial {
  /** Cadena vacía = sin configurar; el botón no se muestra. */
  googleClientId: string;
  facebookAppId: string;
}

/**
 * De dónde salen los client IDs del login social.
 *
 * **Los manda el API, no el `environment`.** El ID token que emite Google lleva
 * en su campo `aud` el cliente con el que se dibujó el botón, y el API rechaza
 * cualquier otro. Mientras el navegador leía `WEB_GOOGLE_CLIENT_ID` y el API
 * comprobaba `GOOGLE_CLIENT_ID`, bastaba con que una de las dos variables
 * estuviera mal —o simplemente sin actualizar— para que todos los accesos con
 * Google terminaran en 401. Con una sola fuente no pueden divergir.
 *
 * Mismo patrón que la clave de navegador del mapa (`GET /geo/config`).
 */
@Injectable({ providedIn: 'root' })
export class SocialConfigService {
  private readonly http = inject(HttpClient);
  private pendiente?: Promise<ConfigSocial>;

  /** Se pide una vez por sesión: los client IDs no cambian mientras la app vive. */
  cargar(): Promise<ConfigSocial> {
    this.pendiente ??= this.pedir();
    return this.pendiente;
  }

  private async pedir(): Promise<ConfigSocial> {
    try {
      return await firstValueFrom(
        this.http.get<ConfigSocial>(`${environment.apiUrl}/auth/social/config`),
      );
    } catch {
      // Un API anterior a este endpoint (o caído) no deja la web sin botones:
      // se cae a lo compilado, que es como funcionaba antes.
      return {
        googleClientId: environment.googleClientId,
        facebookAppId: environment.facebookAppId,
      };
    }
  }
}
