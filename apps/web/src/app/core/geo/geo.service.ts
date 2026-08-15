import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SugerenciaLugar {
  placeId: string;
  descripcion: string;
  principal: string;
  secundario: string;
}

export interface CoordenadasLugar {
  ciudad: string;
  lat: number;
  lng: number;
}

export interface TiposDeCambio {
  base: 'EUR';
  fecha: string;
  tasas: Record<string, number>;
}

/** Configuración de mapas que el API deja ver al navegador. */
export interface ConfigMapas {
  /** Clave de Maps JavaScript; cadena vacía = pintar con OpenStreetMap. */
  mapsApiKey: string;
}

export interface Trayecto {
  km: number;
  duracionMin: number;
  /** true = estimación en línea recta, no medición por carretera. */
  esEstimacion: boolean;
}

/**
 * Acceso a mapas y divisas **a través del API**, nunca directo a Google: la
 * clave vive en el servidor. Todo degrada a vacío si el proxy no responde, para
 * que el buscador siga siendo usable con texto libre.
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/geo`;

  /** Un token por sesión de escritura: Places factura por sesión, no por tecla. */
  private sessionToken = this.nuevoToken();

  private cambio$?: Observable<TiposDeCambio>;
  private claveMapas$?: Observable<string>;

  /**
   * Clave de navegador con la que se pinta el mapa con Google Maps. Se pide una
   * sola vez por sesión y cae a cadena vacía si el API no responde: entonces el
   * mapa usa OpenStreetMap en lugar de quedarse en blanco.
   */
  claveMapas(): Promise<string> {
    this.claveMapas$ ??= this.http.get<ConfigMapas>(`${this.base}/config`).pipe(
      map((config) => config?.mapsApiKey ?? ''),
      catchError(() => of('')),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return firstValueFrom(this.claveMapas$);
  }

  autocompletar(termino: string): Observable<SugerenciaLugar[]> {
    return this.http
      .get<SugerenciaLugar[]>(`${this.base}/autocomplete`, {
        params: { q: termino, session: this.sessionToken },
      })
      .pipe(catchError(() => of([])));
  }

  /**
   * Cierra la sesión de facturación de Places. Se llama al elegir una sugerencia:
   * a partir de ahí, las siguientes pulsaciones abren una sesión nueva.
   */
  cerrarSesion(): void {
    this.sessionToken = this.nuevoToken();
  }

  async coordenadas(placeId: string): Promise<CoordenadasLugar | null> {
    try {
      return await firstValueFrom(
        this.http.get<CoordenadasLugar | null>(`${this.base}/geocode`, { params: { placeId } }),
      );
    } catch {
      return null;
    }
  }

  /** Distancia y duración entre dos poblaciones, para tarificar un traslado. */
  async trayecto(placeIdOrigen: string, placeIdDestino: string): Promise<Trayecto | null> {
    try {
      return await firstValueFrom(
        this.http.get<Trayecto | null>(`${this.base}/trayecto`, {
          params: { origen: placeIdOrigen, destino: placeIdDestino },
        }),
      );
    } catch {
      return null;
    }
  }

  /** Tipos de cambio del BCE, cacheados en memoria durante toda la sesión. */
  tiposDeCambio(): Observable<TiposDeCambio> {
    this.cambio$ ??= this.http.get<TiposDeCambio>(`${this.base}/fx`).pipe(
      catchError(() => of<TiposDeCambio>({ base: 'EUR', fecha: '', tasas: { EUR: 1 } })),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cambio$;
  }

  /**
   * `crypto.randomUUID` no existe en contextos no seguros (http sin TLS) ni en
   * algunos entornos de prueba. El token solo agrupa la facturación de Places,
   * así que basta con que sea razonablemente único.
   */
  private nuevoToken(): string {
    const cripto = globalThis.crypto;
    if (typeof cripto?.randomUUID === 'function') return cripto.randomUUID();
    return `dk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
