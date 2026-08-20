import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** En qué punto se quedó la subida. Debe seguir a `PASOS_SUBIDA` del API. */
export type PasoSubida =
  | 'elegido'
  | 'descartado'
  | 'sin_decodificar'
  | 'sin_convertir'
  | 'demasiado_grande'
  | 'vacio'
  | 'error_http'
  | 'subida';

export interface ParteSubida {
  paso: PasoSubida;
  /** Endpoint al que iba: `image`, `documento` o `video`. */
  destino: string;
  /** Pantalla desde la que se subía; sitúa el fallo sin preguntar al usuario. */
  origen?: string;
  /** El fichero tal y como lo entregó el navegador. */
  fichero?: File | null;
  /** El fichero ya convertido, cuando se llegó a convertir. */
  resultado?: File | null;
  estadoHttp?: number;
  detalle?: string;
}

/**
 * Cuenta al servidor por qué no salió una subida.
 *
 * Existe porque los fallos de subida que importan pasan en el móvil de otra
 * persona: no hay forma de pedirle que abra la consola, y el mensaje que ve
 * ("no se pudo subir") no distingue entre una foto en iCloud, un HEIC que el
 * navegador no supo abrir y una sesión caducada. Con el parte en los registros
 * del servidor, cada caso se reconoce de un vistazo.
 *
 * **Nunca lanza y nunca espera.** Un diagnóstico que rompiera —o que retrasara—
 * la pantalla que intenta diagnosticar sería peor que no tenerlo.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticoSubidaService {
  private readonly http = inject(HttpClient);

  registrar(parte: ParteSubida): void {
    const cuerpo = {
      paso: parte.paso,
      destino: parte.destino,
      origen: parte.origen,
      nombre: parte.fichero?.name,
      // Se manda vacío tal cual: que iOS no rellene el tipo es justamente uno
      // de los datos que hacen falta.
      tipo: parte.fichero?.type ?? '',
      bytes: parte.fichero?.size,
      tipoFinal: parte.resultado?.type,
      bytesFinales: parte.resultado?.size,
      estadoHttp: parte.estadoHttp,
      detalle: parte.detalle?.slice(0, 300),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : undefined,
    };

    // También en la consola del propio dispositivo: si alguien puede mirarla,
    // se ahorra el viaje al servidor.
    if (parte.paso !== 'subida' && parte.paso !== 'elegido') {
      console.warn('[subida]', cuerpo);
    }

    this.http.post(`${environment.apiUrl}/upload/diagnostico`, cuerpo)
      .subscribe({ error: () => undefined });
  }

  /** Traduce un fallo HTTP a algo que se pueda leer en el registro. */
  registrarFalloHttp(parte: Omit<ParteSubida, 'paso'>, error: unknown): void {
    const http = error instanceof HttpErrorResponse ? error : null;
    this.registrar({
      ...parte,
      paso: 'error_http',
      estadoHttp: http?.status,
      detalle: http ? `${http.statusText}: ${this.mensajeDe(http)}` : String(error),
    });
  }

  private mensajeDe(error: HttpErrorResponse): string {
    const cuerpo = error.error as { message?: string | string[] } | string | null;
    if (typeof cuerpo === 'string') return cuerpo;
    const mensaje = cuerpo?.message;
    return Array.isArray(mensaje) ? mensaje.join(', ') : mensaje ?? '';
  }
}
