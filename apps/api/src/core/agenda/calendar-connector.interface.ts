/** Token OAuth de un proveedor de calendario, ya normalizado. */
export interface TokensCalendario {
  accessToken: string;
  refreshToken?: string;
  expiraEn: Date;
}

/** Evento de calendario, en el formato común a todos los proveedores. */
export interface EventoCalendario {
  /** Identificador en el proveedor; permite reconciliar sin duplicar. */
  externalEventId: string;
  titulo: string;
  inicio: Date;
  fin: Date;
  /** true = el profesional no está disponible en esa franja. */
  ocupado: boolean;
}

export interface NuevoEventoCalendario {
  titulo: string;
  descripcion?: string;
  inicio: Date;
  fin: Date;
  zonaHoraria: string;
}

/**
 * Contrato común de los proveedores de calendario (§18-I: interfaces pequeñas).
 *
 * Existe para que añadir Outlook, o mañana un CRM, no obligue a tocar la lógica
 * de agenda: el servicio habla con esta interfaz, nunca con Google.
 */
export interface CalendarConnector {
  readonly proveedor: ProveedorCalendario;

  /** URL a la que se manda al profesional para autorizar el acceso. */
  urlAutorizacion(estado: string): string;

  /** Canjea el código de la vuelta de OAuth por tokens utilizables. */
  canjearCodigo(codigo: string): Promise<TokensCalendario>;

  /** Renueva el acceso cuando caduca, sin volver a pedir permiso. */
  refrescar(refreshToken: string): Promise<TokensCalendario>;

  /** Eventos del proveedor en un rango; alimentan los bloqueos de agenda. */
  listarEventos(tokens: TokensCalendario, desde: Date, hasta: Date): Promise<EventoCalendario[]>;

  /** Publica una reserva de Doogking en el calendario del profesional. */
  crearEvento(tokens: TokensCalendario, evento: NuevoEventoCalendario): Promise<string>;

  /** Retira el evento cuando la reserva se cancela. */
  eliminarEvento(tokens: TokensCalendario, externalEventId: string): Promise<void>;
}

export type ProveedorCalendario = 'google' | 'microsoft';

/** Token de DI del registro de conectores disponibles. */
export const CALENDAR_CONNECTORS = Symbol('CALENDAR_CONNECTORS');
