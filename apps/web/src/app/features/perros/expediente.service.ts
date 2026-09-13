import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PerroApi } from './perros.service';
import { descargarBlob, nombreInforme } from '../../shared/exportacion/descargar-archivo';

/** Contacto del dueño: sólo lo recibe el comercio que atiende a la mascota. */
export interface ContactoPropietarioApi {
  nombre?: string;
  email?: string;
  telefono?: string;
}

/** Lo que un profesional anotó tras un servicio. */
export interface RegistroServicioApi {
  _id: string;
  vertical: string;
  tipoHistorial?: string;
  origen: 'comercio' | 'propietario';
  titulo?: string;
  nota: string;
  datosEstructurados: Record<string, string | number | undefined>;
  fechaServicio?: string;
  profesional?: string;
  proximaCita?: string;
  reservaId?: string;
  comercioId?: string;
  comercioNombre?: string;
  esPropio: boolean;
  createdAt?: string;
  editadaAt?: string;
}

/** Reserva de la mascota vista como servicio realizado o próximo. */
export interface ServicioExpedienteApi {
  reservaId: string;
  codigo: string;
  vertical: string;
  servicioTitulo?: string;
  comercioId: string;
  comercioNombre?: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: string;
}

export interface ExpedienteApi {
  perro: PerroApi & Record<string, unknown>;
  propietario?: ContactoPropietarioApi;
  registros: RegistroServicioApi[];
  servicios: ServicioExpedienteApi[];
}

/** Tarjeta de la lista "Mascotas" del panel del comercio. */
export interface MascotaComercioApi {
  perroId: string;
  nombre: string;
  foto?: string;
  raza?: string;
  fechaNacimiento?: string;
  sexo?: string;
  peso?: number;
  tamano?: string;
  alergias: string[];
  enfermedades: string[];
  tieneMedicacion: boolean;
  propietario: ContactoPropietarioApi;
  totalReservas: number;
  serviciosCompletados: number;
  ultimoServicio?: string;
  verticales: string[];
  totalRegistros: number;
}

export interface RegistroServicioPayload {
  vertical?: string;
  reservaId?: string;
  titulo?: string;
  nota?: string;
  fechaServicio?: string;
  profesional?: string;
  proximaCita?: string;
  datosEstructurados?: Record<string, string | number>;
}

@Injectable({ providedIn: 'root' })
export class ExpedienteService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // ── Cuenta del dueño ──

  delPropietario(perroId: string): Promise<ExpedienteApi> {
    return firstValueFrom(this.http.get<ExpedienteApi>(`${this.api}/perros/${perroId}/expediente`));
  }

  descargarInformePropietario(perroId: string, nombre: string): Promise<void> {
    return this.descargar(`${this.api}/perros/${perroId}/informe`, nombre);
  }

  // ── Panel del comercio ──

  mascotasDelComercio(busqueda = ''): Promise<MascotaComercioApi[]> {
    const params = busqueda.trim() ? new HttpParams().set('q', busqueda.trim()) : undefined;
    return firstValueFrom(this.http.get<MascotaComercioApi[]>(`${this.api}/comercio/mascotas`, { params }));
  }

  delComercio(perroId: string): Promise<ExpedienteApi> {
    return firstValueFrom(this.http.get<ExpedienteApi>(`${this.api}/comercio/mascotas/${perroId}`));
  }

  crearRegistro(perroId: string, payload: RegistroServicioPayload): Promise<RegistroServicioApi> {
    return firstValueFrom(
      this.http.post<RegistroServicioApi>(`${this.api}/comercio/mascotas/${perroId}/registros`, payload),
    );
  }

  actualizarRegistro(perroId: string, registroId: string, payload: RegistroServicioPayload): Promise<RegistroServicioApi> {
    return firstValueFrom(
      this.http.patch<RegistroServicioApi>(`${this.api}/comercio/mascotas/${perroId}/registros/${registroId}`, payload),
    );
  }

  eliminarRegistro(perroId: string, registroId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.api}/comercio/mascotas/${perroId}/registros/${registroId}`));
  }

  descargarInformeComercio(perroId: string, nombre: string): Promise<void> {
    return this.descargar(`${this.api}/comercio/mascotas/${perroId}/informe`, nombre);
  }

  private async descargar(url: string, nombre: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    descargarBlob(blob, nombreInforme(nombre));
  }
}
