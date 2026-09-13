/**
 * Formas que devuelve el expediente de una mascota. Viven aparte del servicio
 * porque las comparten los dos controladores (comercio y propietario) y el
 * generador del informe PDF.
 */

export interface ContactoPropietario {
  nombre?: string;
  email?: string;
  telefono?: string;
}

/** Una entrada del historial, con el nombre del negocio que la escribió. */
export interface RegistroExpediente {
  _id: string;
  vertical: string;
  tipoHistorial?: string;
  origen: 'comercio' | 'propietario';
  titulo?: string;
  nota: string;
  datosEstructurados: Record<string, unknown>;
  fechaServicio?: Date;
  profesional?: string;
  proximaCita?: Date;
  reservaId?: string;
  comercioId?: string;
  comercioNombre?: string;
  /** Lo escribió el comercio que consulta: sólo ése puede corregirlo. */
  esPropio: boolean;
  createdAt?: Date;
  editadaAt?: Date;
}

/** Una reserva de la mascota, como servicio realizado o próximo. */
export interface ServicioExpediente {
  reservaId: string;
  codigo: string;
  vertical: string;
  servicioTitulo?: string;
  comercioId: string;
  comercioNombre?: string;
  fechaInicio: Date;
  fechaFin?: Date;
  estado: string;
}

export interface ExpedienteMascota {
  perro: Record<string, unknown>;
  propietario?: ContactoPropietario;
  registros: RegistroExpediente[];
  servicios: ServicioExpediente[];
}

/** Tarjeta de la lista de mascotas del panel del comercio. */
export interface MascotaComercioResumen {
  perroId: string;
  nombre: string;
  foto?: string;
  raza?: string;
  fechaNacimiento?: Date;
  sexo?: string;
  peso?: number;
  tamano?: string;
  alergias: string[];
  enfermedades: string[];
  tieneMedicacion: boolean;
  propietario: ContactoPropietario;
  totalReservas: number;
  serviciosCompletados: number;
  ultimoServicio?: Date;
  verticales: string[];
  totalRegistros: number;
}

/** Datos con los que se compone el informe PDF. */
export interface DatosInforme {
  emisor: string;
  destinatario: 'comercio' | 'propietario';
  expediente: ExpedienteMascota;
}
