import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ContactoComercio {
  nombreContacto?: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
}

export interface DireccionComercio {
  calle?: string;
  numero?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
  pais?: string;
  lat?: number;
  lng?: number;
}

export interface RedesSociales {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
}

export interface HorarioDia {
  dia: string;
  abre?: string;
  cierra?: string;
  cerrado: boolean;
}

export interface DatosBancarios {
  titular?: string;
  iban?: string;
  banco?: string;
  swift?: string;
}

export interface VerificacionComercio {
  estado: 'sin_verificar' | 'pendiente' | 'verificado' | 'rechazado';
  documentoIdentidadUrl?: string;
  licenciaNegocioUrl?: string;
}

export interface PreferenciasNotificacion {
  nuevaReserva: boolean;
  cancelacion: boolean;
  resena: boolean;
  pagos: boolean;
}

export interface MiComercio {
  _id: string;
  nombreComercial: string;
  razonSocial: string;
  vatNumber: string;
  descripcion?: string;
  logoUrl?: string;
  coverUrl?: string;
  galeria: string[];
  sitioWeb?: string;
  verticales: string[];
  plan: string;
  estado: string;
  contacto?: ContactoComercio;
  direccion?: DireccionComercio;
  redesSociales?: RedesSociales;
  horario: HorarioDia[];
  politicaCancelacion?: 'flexible' | 'moderada' | 'estricta';
  datosBancarios?: DatosBancarios;
  verificacion: VerificacionComercio;
  preferenciasNotificacion: PreferenciasNotificacion;
}

export type ActualizarPerfilComercioPayload = Partial<
  Pick<
    MiComercio,
    | 'nombreComercial'
    | 'descripcion'
    | 'logoUrl'
    | 'coverUrl'
    | 'galeria'
    | 'sitioWeb'
    | 'politicaCancelacion'
    | 'contacto'
    | 'direccion'
    | 'redesSociales'
    | 'datosBancarios'
    | 'preferenciasNotificacion'
    | 'horario'
  >
> & { documentoIdentidadUrl?: string; licenciaNegocioUrl?: string };

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

/** Payload base común a crear/actualizar un listado; los campos propios del vertical
 *  (espacios, tarifas, servicios clínicos/grooming, cupos…) van en `extra`. */
export interface ServicioPayload {
  vertical?: string;
  titulo?: string;
  descripcion?: string;
  ciudad?: string;
  precioBase?: number;
  imagenes?: string[];
  extra?: Record<string, unknown>;
}

export interface ServicioGestion {
  id: string;
  vertical: string;
  titulo: string;
  descripcion: string;
  ciudad: string;
  precioBase: number;
  imagenes: string[];
  estado: string;
  extra: Record<string, unknown>;
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
  private readonly catalogUrl = `${environment.apiUrl}/catalog/servicios`;

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

  crearServicio(dto: ServicioPayload): Observable<MiServicio> {
    return this.http.post<MiServicio>(this.catalogUrl, dto);
  }

  obtenerServicioGestion(id: string): Observable<ServicioGestion> {
    return this.http.get<ServicioGestion>(`${this.catalogUrl}/${id}/gestion`);
  }

  actualizarServicio(id: string, dto: ServicioPayload): Observable<MiServicio> {
    return this.http.patch<MiServicio>(`${this.catalogUrl}/${id}`, dto);
  }

  getMisResenas(): Observable<MiResena[]> {
    return this.http.get<MiResena[]>(`${this.url}/mis-resenas`);
  }

  responderResena(id: string, texto: string): Observable<MiResena> {
    return this.http.patch<MiResena>(`${this.url}/mis-resenas/${id}/respuesta`, { texto });
  }

  actualizarComercio(dto: ActualizarPerfilComercioPayload): Observable<MiComercio> {
    return this.http.patch<MiComercio>(`${this.url}/mi-comercio`, dto);
  }
}
