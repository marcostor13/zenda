/**
 * Ficha completa de un comercio para el panel de administración.
 *
 * Sustituye al diálogo de "Ver ficha", que sólo cabía siete KPIs y diez
 * reservas: quien revisa un negocio necesita su catálogo, su dinero, su equipo
 * y sus incidencias en la misma pantalla, y eso no entra en un modal.
 */
export interface DetalleComercioDto {
  comercio: ComercioDetalleDto;
  /** Comisión que se aplicaría hoy en cada vertical del comercio. */
  comisiones: ComisionAplicadaDto[];
  metricas: MetricasComercioDto;
  servicios: ServicioDeComercioDto[];
  reservas: ReservaDeComercioDto[];
  equipo: MiembroDeComercioDto[];
  resenas: ResenaDeComercioDto[];
  incidencias: IncidenciaDeComercioDto[];
}

export interface ContactoComercioDetalleDto {
  nombreContacto?: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
}

export interface DireccionComercioDetalleDto {
  calle?: string;
  numero?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
  pais?: string;
  lat?: number;
  lng?: number;
}

export interface DatosBancariosDetalleDto {
  titular?: string;
  /** Enmascarado salvo los cuatro últimos dígitos; el IBAN completo no sale del API. */
  iban?: string;
  banco?: string;
  swift?: string;
}

export interface ConsentimientoDetalleDto {
  aceptado: boolean;
  fecha?: string;
  version?: string;
}

export interface BajaComercioDetalleDto {
  motivo: string;
  comentario?: string;
  fecha: string;
  origen: string;
  estadoPrevio?: string;
  reactivarEl?: string;
  aceptaContacto?: boolean;
}

export interface ComercioDetalleDto {
  _id: string;
  nombreComercial: string;
  razonSocial?: string;
  vatNumber?: string;
  descripcion?: string;
  verticales: string[];
  plan: string;
  estado: string;
  modoLiquidacion: string;
  comisionPctOverride?: number;
  socioFundador: boolean;
  comisionPctCongelada?: number;
  congelacionHasta?: string;
  alphaAdherido: boolean;
  cohorte?: string;
  politicaCancelacion?: string;
  altaCompletada: boolean;
  contacto?: ContactoComercioDetalleDto;
  direccion?: DireccionComercioDetalleDto;
  datosBancarios?: DatosBancariosDetalleDto;
  consentimientos?: Record<string, ConsentimientoDetalleDto>;
  preferenciasNotificacion?: Record<string, boolean>;
  baja?: BajaComercioDetalleDto;
  eliminadoAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Porcentaje vigente en un vertical y de dónde sale (§11.2 de CLAUDE.md). */
export interface ComisionAplicadaDto {
  vertical: string;
  comisionPct: number;
  origen: 'override_comercio' | 'socio_fundador' | 'vertical' | 'defecto';
  stripePct: number;
  stripeFijoEur: number;
}

export interface MetricasComercioDto {
  servicios: {
    total: number;
    publicados: number;
    borradores: number;
    pausados: number;
    destacados: number;
  };
  reservas: {
    total: number;
    porEstado: Record<string, number>;
    activas: number;
    ultimos30Dias: number;
    proximas: number;
  };
  economia: {
    gmv: number;
    comision: number;
    stripeFee: number;
    liquidacion: number;
    ticketMedio: number;
    pagosAprobados: number;
    reembolsado: number;
  };
  resenas: {
    media: number;
    total: number;
    distribucion: Record<string, number>;
    sinResponder: number;
  };
  incidencias: { total: number; abiertas: number };
  equipo: { total: number; porRol: Record<string, number> };
  porVertical: VerticalDeComercioDto[];
  /** Últimos doce meses, del más antiguo al más reciente. */
  mensual: MesDeComercioDto[];
}

export interface VerticalDeComercioDto {
  vertical: string;
  servicios: number;
  reservas: number;
  gmv: number;
  comision: number;
}

export interface MesDeComercioDto {
  /** `YYYY-MM`. */
  mes: string;
  reservas: number;
  gmv: number;
  comision: number;
}

export interface ServicioDeComercioDto {
  _id: string;
  titulo: string;
  vertical: string;
  estado: string;
  destacado: boolean;
  precioBase: number;
  moneda: string;
  ciudad?: string;
  imagen?: string;
  ratingPromedio: number;
  totalResenas: number;
  reservas: number;
  gmv: number;
  ultimaReserva?: string;
  createdAt?: string;
}

export interface ReservaDeComercioDto {
  _id: string;
  codigo: string;
  vertical: string;
  servicio?: string;
  cliente: string;
  clienteEmail?: string;
  perro?: string;
  estado: string;
  estadoPago: string;
  fechaInicio?: string;
  fechaFin?: string;
  cantidad: number;
  montoTotal: number;
  comisionMonto: number;
  stripeFee: number;
  montoLiquidacion: number;
  createdAt: string;
}

export interface MiembroDeComercioDto {
  _id: string;
  nombre: string;
  email: string;
  telefono?: string;
  rol: string;
  verificado: boolean;
  createdAt?: string;
}

export interface ResenaDeComercioDto {
  _id: string;
  usuarioNombre: string;
  servicioTitulo: string;
  puntuacion: number;
  comentario: string;
  respuesta?: string | null;
  createdAt?: string;
}

export interface IncidenciaDeComercioDto {
  _id: string;
  asunto: string;
  tipo: string;
  estado: string;
  origen: string;
  abiertaPorNombre: string;
  codigoReserva?: string;
  createdAt?: string;
}
