import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface EstadoPush {
  /** false = faltan credenciales de FCM en el servidor y no sale nada. */
  configurado: boolean;
  dispositivos: { todos: number; clientes: number; comercios: number };
}

export interface ResultadoAviso {
  enviados: number;
  destinatarios: number;
  omitido: boolean;
}

export interface AvisoProgramado {
  _id: string;
  nombre: string;
  disparador: string;
  segmento: string;
  titulo: string;
  cuerpo: string;
  ruta: string;
  hora: string;
  diasSemana: number[];
  diasAntelacion: number;
  activo: boolean;
  ultimaEjecucion?: string;
  ultimoEnviados: number;
}

@Injectable({ providedIn: 'root' })
export class AdminAvisosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/avisos`;

  estado(): Promise<EstadoPush> {
    return firstValueFrom(this.http.get<EstadoPush>(`${this.base}/estado`));
  }

  enviar(datos: Record<string, unknown>): Promise<ResultadoAviso> {
    return firstValueFrom(this.http.post<ResultadoAviso>(`${this.base}/enviar`, datos));
  }

  listar(): Promise<AvisoProgramado[]> {
    return firstValueFrom(this.http.get<AvisoProgramado[]>(`${this.base}/programados`));
  }

  crear(datos: Record<string, unknown>): Promise<AvisoProgramado> {
    return firstValueFrom(this.http.post<AvisoProgramado>(`${this.base}/programados`, datos));
  }

  actualizar(id: string, datos: Record<string, unknown>): Promise<AvisoProgramado> {
    return firstValueFrom(this.http.patch<AvisoProgramado>(`${this.base}/programados/${id}`, datos));
  }

  eliminar(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/programados/${id}`));
  }

  /** Dispara el aviso ahora, para comprobar cómo queda. */
  ejecutar(id: string): Promise<ResultadoAviso> {
    return firstValueFrom(
      this.http.post<ResultadoAviso>(`${this.base}/programados/${id}/ejecutar`, {}),
    );
  }
}
