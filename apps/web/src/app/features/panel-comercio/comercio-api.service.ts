import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MiComercio {
  _id: string;
  nombreComercial: string;
  razonSocial: string;
  logoUrl?: string;
  verticales: string[];
  plan: string;
  estado: string;
}

export interface MiReserva {
  _id: string;
  codigo: string;
  vertical: string;
  montoTotal: number;
  estado: string;
  fechaInicio: string;
  fechaFin?: string;
  createdAt: string;
}

export interface EspacioDisponibilidad {
  id?: string;
  tipo: 'suite' | 'estandar' | 'compartido';
  tamanoMaxPerro: 'pequeno' | 'mediano' | 'grande' | 'gigante';
  precioNoche: number;
  cantidad: number;
  disponible: boolean;
}

export interface MiServicio {
  _id: string;
  titulo: string;
  vertical: string;
  precioBase: number;
  estado: string;
  ratingPromedio?: number;
  imagenes?: string[];
  /** Disponibilidad por vertical (D1): solo viene poblado el campo propio del vertical. */
  espacios?: EspacioDisponibilidad[];
  unidadesDisponibles?: number;
  citasDisponibles?: number;
  cuposDisponibles?: number;
}

export interface DisponibilidadPayload {
  espacios?: EspacioDisponibilidad[];
  unidadesDisponibles?: number;
  citasDisponibles?: number;
  cuposDisponibles?: number;
}

export interface MiResena {
  _id: string;
  servicioId: string;
  servicioTitulo: string;
  vertical: string;
  puntuacion: number;
  comentario: string;
  usuarioNombre: string;
  createdAt: string;
  respuesta?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ComercioApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/comercios`;

  getMiComercio(): Observable<MiComercio> {
    return this.http.get<MiComercio>(`${this.url}/mi-comercio`);
  }

  getMisReservas(): Observable<MiReserva[]> {
    return this.http.get<MiReserva[]>(`${this.url}/mis-reservas`);
  }

  completarReserva(reservaId: string): Observable<MiReserva> {
    return this.http.patch<MiReserva>(`${this.url}/mis-reservas/${reservaId}/completar`, {});
  }

  getMisServicios(): Observable<MiServicio[]> {
    return this.http.get<MiServicio[]>(`${this.url}/mis-servicios`);
  }

  cambiarEstadoServicio(id: string, estado: 'publicado' | 'pausado' | 'borrador'): Observable<MiServicio> {
    return this.http.patch<MiServicio>(`${this.url}/mis-servicios/${id}/estado`, { estado });
  }

  actualizarDisponibilidad(id: string, cambios: DisponibilidadPayload): Observable<MiServicio> {
    return this.http.patch<MiServicio>(`${this.url}/mis-servicios/${id}/disponibilidad`, cambios);
  }

  crearServicio(dto: {
    vertical: string;
    titulo: string;
    descripcion: string;
    ciudad: string;
    precioBase: number;
    imagenes?: string[];
    /** Campos propios del vertical elegido (espacios, tarifas, servicios clínicos/grooming, cupos…). */
    extra?: Record<string, unknown>;
  }): Observable<MiServicio> {
    return this.http.post<MiServicio>(`${environment.apiUrl}/catalog/servicios`, dto);
  }

  getMisResenas(): Observable<MiResena[]> {
    return this.http.get<MiResena[]>(`${this.url}/mis-resenas`);
  }

  responderResena(id: string, texto: string): Observable<MiResena> {
    return this.http.patch<MiResena>(`${this.url}/mis-resenas/${id}/respuesta`, { texto });
  }

  actualizarComercio(dto: Partial<MiComercio & { descripcion?: string; email?: string; telefono?: string }>): Observable<MiComercio> {
    return this.http.patch<MiComercio>(`${this.url}/mi-comercio`, dto);
  }
}
