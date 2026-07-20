import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PerroApi {
  _id: string;
  nombre: string;
  fotos: string[];
  especie: string;
  raza?: string;
  esMestizo: boolean;
  fechaNacimiento?: string;
  sexo?: 'macho' | 'hembra';
  esterilizado: boolean;
  peso?: number;
  microchip?: string;
  tipoPelo: string[];
  tamano?: string;
  estadoManto?: string;
  vacunas: string[];
  alergias: string[];
  enfermedades: string[];
  medicacion: string[];
  dieta?: string;
  sociabilidadPerros?: string;
  sociabilidadPersonas?: string;
  puedeQuedarseSolo: boolean;
  ansiedadSeparacion: boolean;
  miedos: string[];
  temperamento?: string;
  seMarea: boolean;
  requiereTransportin: boolean;
  autorizaCompartirHistorial: boolean;
  nivelDoogking?: number;
  createdAt?: string;
}

export interface PerroPayload {
  nombre?: string;
  raza?: string;
  esMestizo?: boolean;
  fechaNacimiento?: string;
  sexo?: 'macho' | 'hembra';
  esterilizado?: boolean;
  peso?: number;
  tipoPelo?: string[];
  tamano?: string;
  estadoManto?: string;
  vacunas?: string[];
  alergias?: string[];
  enfermedades?: string[];
  medicacion?: string[];
  dieta?: string;
  sociabilidadPerros?: string;
  sociabilidadPersonas?: string;
  puedeQuedarseSolo?: boolean;
  ansiedadSeparacion?: boolean;
  miedos?: string[];
  temperamento?: string;
  seMarea?: boolean;
  requiereTransportin?: boolean;
  autorizaCompartirHistorial?: boolean;
}

export interface PerroHistorialApi {
  _id: string;
  vertical: string;
  nota: string;
  createdAt: string;
}

export interface IndiceComportamientoApi {
  puntuacionPromedio: number;
  totalValoraciones: number;
  atributosPromedio: Record<string, number>;
}

/** Historia Veterinaria Compartida: ficha de salud + historial, con autorización del propietario. */
export interface HistoriaCompartidaApi {
  nombre: string;
  especie: string;
  raza?: string;
  fechaNacimiento?: string;
  sexo?: string;
  esterilizado: boolean;
  peso?: number;
  vacunas: string[];
  alergias: string[];
  enfermedades: string[];
  medicacion: string[];
  dieta?: string;
  cartillaSanitariaUrl?: string;
  pasaporteEuropeoUrl?: string;
  certificadosUrl: string[];
  historial: Array<{ vertical: string; nota: string; createdAt?: string }>;
}

export interface CrearValoracionPayload {
  reservaId: string;
  puntuacion: number;
  atributos?: Record<string, number>;
  comentario?: string;
}

@Injectable({ providedIn: 'root' })
export class PerrosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/perros`;

  misPerros(): Promise<PerroApi[]> {
    return firstValueFrom(this.http.get<PerroApi[]>(`${this.base}/mis`));
  }

  obtener(id: string): Promise<PerroApi> {
    return firstValueFrom(this.http.get<PerroApi>(`${this.base}/${id}`));
  }

  crear(payload: PerroPayload): Promise<PerroApi> {
    return firstValueFrom(this.http.post<PerroApi>(this.base, payload));
  }

  actualizar(id: string, payload: PerroPayload): Promise<PerroApi> {
    return firstValueFrom(this.http.patch<PerroApi>(`${this.base}/${id}`, payload));
  }

  eliminar(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  historial(id: string): Promise<PerroHistorialApi[]> {
    return firstValueFrom(this.http.get<PerroHistorialApi[]>(`${this.base}/${id}/historial`));
  }

  indiceComportamiento(id: string): Promise<IndiceComportamientoApi> {
    return firstValueFrom(this.http.get<IndiceComportamientoApi>(`${this.base}/${id}/indice-comportamiento`));
  }

  historiaVeterinaria(id: string): Promise<HistoriaCompartidaApi> {
    return firstValueFrom(this.http.get<HistoriaCompartidaApi>(`${this.base}/${id}/historia-veterinaria`));
  }

  crearValoracion(id: string, payload: CrearValoracionPayload): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.base}/${id}/valoraciones`, payload));
  }
}
