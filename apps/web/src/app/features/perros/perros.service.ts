import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TipoHistorial, Vacuna, VerticalKey } from 'shared';
import { environment } from '../../../environments/environment';

/** Vacuna marcada en la ficha, con la fecha si el dueño la recuerda. */
export interface VacunaAplicada {
  tipo: Vacuna;
  fecha?: string;
}

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
  vacunasDetalle?: VacunaAplicada[];
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
  orinaEnInterior?: boolean;
  ladraAlQuedarseSolo?: boolean;
  destructivoEnSoledad?: boolean;
  notasAlojamiento?: string;
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
  vacunasDetalle?: VacunaAplicada[];
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
  orinaEnInterior?: boolean;
  ladraAlQuedarseSolo?: boolean;
  destructivoEnSoledad?: boolean;
  notasAlojamiento?: string;
  autorizaCompartirHistorial?: boolean;
}

export interface PerroHistorialApi {
  _id: string;
  vertical: string;
  tipoHistorial?: TipoHistorial;
  origen?: 'comercio' | 'propietario';
  nota: string;
  createdAt: string;
  editadaAt?: string;
}

/** Permiso para que una categoría de servicio vea un tipo de historial. */
export interface ConsentimientoApi {
  _id: string;
  tipoHistorial: TipoHistorial;
  verticalDestino: VerticalKey;
  concedido: boolean;
  fechaConcesion?: string;
  fechaRevocacion?: string;
}

/** Entrada del historial de cambios de la ficha. */
export interface PerroVersionApi {
  _id: string;
  campos: string[];
  anterior: Record<string, unknown>;
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

  // ── Privacidad: quién ve qué del historial de la mascota (RGPD) ──

  consentimientos(id: string): Promise<ConsentimientoApi[]> {
    return firstValueFrom(this.http.get<ConsentimientoApi[]>(`${this.base}/${id}/consentimientos`));
  }

  fijarConsentimiento(
    id: string,
    payload: { tipoHistorial: TipoHistorial; verticalDestino: VerticalKey; concedido: boolean },
  ): Promise<ConsentimientoApi> {
    return firstValueFrom(
      this.http.patch<ConsentimientoApi>(`${this.base}/${id}/consentimientos`, payload),
    );
  }

  revocarTodos(id: string): Promise<{ revocados: number }> {
    return firstValueFrom(
      this.http.delete<{ revocados: number }>(`${this.base}/${id}/consentimientos`),
    );
  }

  versiones(id: string): Promise<PerroVersionApi[]> {
    return firstValueFrom(this.http.get<PerroVersionApi[]>(`${this.base}/${id}/versiones`));
  }

  editarHistorial(id: string, historialId: string, nota: string): Promise<PerroHistorialApi> {
    return firstValueFrom(
      this.http.patch<PerroHistorialApi>(`${this.base}/${id}/historial/${historialId}`, { nota }),
    );
  }

  eliminarHistorial(id: string, historialId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}/historial/${historialId}`));
  }
}
