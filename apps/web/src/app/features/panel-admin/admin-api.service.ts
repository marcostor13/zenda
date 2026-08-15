import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardKpis {
  totalReservas: number;
  gmvMes: number;
  ingresosMes: number;
  comerciosPendientesCount: number;
  totalUsuarios: number;
  verificacionesPendientes: number;
  nuevosComerciosMes: number;
  mascotasRegistradas: number;
  tasaCancelacionMes: number;
  pagosRetenidosMonto: number;
  pagosRetenidosCount: number;
  incidenciasAbiertas: number;
}

export interface ComercioPendiente {
  id: string;
  nombre: string;
  nif: string;
  vertical: string;
  inicial: string;
}

export interface UltimaReserva {
  id: string;
  codigo: string;
  vertical: string;
  montoTotal: number;
  estado: string;
  createdAt: string;
  fechaServicio: string | null;
  cliente: string;
  comercio: string;
  servicio: string;
  comisionMonto: number;
}

export interface ComisionConfig {
  _id: string;
  vertical: string;
  comisionPct: number;
  stripePct: number;
  stripeFijoEur: number;
  activo: boolean;
}

/** Variación frente al periodo anterior; `null` cuando no había datos con los que comparar. */
export interface ComparativaDashboard {
  gmvPct: number | null;
  ingresosPct: number | null;
  reservasPct: number | null;
  comerciosPct: number | null;
}

export interface AdminDashboardResponse {
  kpis: DashboardKpis;
  comerciosPendientes: ComercioPendiente[];
  ultimasReservas: UltimaReserva[];
  comisiones: ComisionConfig[];
  periodo: { desde: string; hasta: string };
  comparativa: ComparativaDashboard;
}

/** Un escalón del programa de fidelización Doogking Alpha (Bloque 13). */
export interface AlphaNivel {
  nivel: number;
  nombre: string;
  reservasRequeridas: number;
  descuentoPct: number;
  beneficios: string[];
}

export interface DocumentoVerificacion {
  tipo: string;
  nombre?: string;
  url: string;
  fechaCaducidad?: string;
  estado: string;
}

export interface VerificacionComercio {
  estado: string;
  documentos?: DocumentoVerificacion[];
  motivoRechazo?: string;
}

export interface ComercioAdmin {
  _id: string;
  nombreComercial: string;
  razonSocial: string;
  vatNumber: string;
  verticales: string[];
  plan: string;
  estado: string;
  comisionPctOverride?: number;
  logoUrl?: string;
  createdAt: string;
  verificacion?: VerificacionComercio;
  /** Adherido al programa Doogking Alpha (HU-13.3). */
  alphaAdherido?: boolean;
}

export interface ReservaAdmin {
  _id: string;
  codigo: string;
  vertical: string;
  montoTotal: number;
  comisionMonto: number;
  estado: string;
  fechaInicio?: string;
  createdAt: string;
  cliente: string;
  comercio: string;
  clienteEmail?: string;
  servicio?: string;
  /** Estado del pago, distinto del estado de la reserva (TCK-8036). */
  estadoPago?: string;
  /** Desglose económico de la reserva, para la ficha administrativa. */
  stripeFee?: number;
  montoLiquidacion?: number;
  perroNombre?: string;
  suplementos?: Array<{ concepto: string; monto: number; motivo?: string }>;
  montoAjustado?: number;
  fechaFin?: string;
  cantidad?: number;
  historialEstados?: CambioEstadoReserva[];
}

/** Una acción administrativa registrada (TCK-8030 §8, 8034, 8035 §9). */
export interface RegistroAuditoria {
  _id: string;
  actorNombre: string;
  entidad: string;
  entidadId?: string;
  descripcion: string;
  motivo?: string;
  createdAt: string;
}

/** Un pago con su desglose económico, para el control del dinero (TCK-8040 §1). */
export interface PagoAdmin {
  _id: string;
  codigoReserva: string;
  comercio: string;
  vertical: string;
  montoTotal: number;
  comisionPlataforma: number;
  stripeFee: number;
  montoLiquidacion: number;
  estado: string;
  createdAt: string;
}

/** Una liquidación registrada a un comercio (TCK-8040 §1). */
export interface Liquidacion {
  _id: string;
  comercioNombre: string;
  desde: string;
  hasta: string;
  facturacionBruta: number;
  comisionPlataforma: number;
  stripeFee: number;
  importeNeto: number;
  reservas: number;
  estado: 'pendiente' | 'pagada';
  fechaPago?: string;
  referencia?: string;
  createdAt: string;
}

export interface ResumenPagos {
  cobrado: number;
  comisionDoogking: number;
  costePasarela: number;
  liquidadoComercios: number;
  pendienteLiquidar: number;
  reembolsado: number;
}

/** Contadores e importes de la cabecera del centro de reservas (TCK-8036). */
export interface ResumenReservas {
  porEstado: Record<string, number>;
  total: number;
  importeReservado: number;
  comisiones: number;
  pagosRetenidos: number;
  reembolsos: number;
}

export interface CambioEstadoReserva {
  estado: string;
  motivo?: string;
  por: string;
  at: string;
}

export interface VerticalAnalitica {
  vertical: string;
  reservas: number;
  porcentaje: number;
  facturacion: number;
  comision: number;
  comercios: number;
}

export interface ComercioTop {
  comercio: string;
  reservas: number;
  facturacion: number;
  valoracion: number;
}

export interface AnaliticaAdmin {
  kpis: {
    usuariosNuevosMes: number;
    reservas: number;
    conversionPct: number;
    facturacion: number;
    comision: number;
    ticketMedio: number;
  };
  porVertical: VerticalAnalitica[];
  porCiudad: Array<{ ciudad: string; reservas: number; comercios: number; facturacion: number }>;
  topComercios: ComercioTop[];
  embudo: { registrados: number; conReserva: number; pagaron: number };
}

export interface FiltrosReservasAdmin {
  estado?: string;
  comercioId?: string;
  buscar?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface UsuarioAdmin {
  _id: string;
  nombre: string;
  email: string;
  rol: string;
  verificado: boolean;
  telefono?: string;
  comercioId?: string;
  createdAt: string;
  /** Reservas hechas como cliente; sin valor para cuentas que no son de cliente. */
  reservas?: number;
  /** Nivel Doogking Alpha: sólo llega para clientes (TCK-8035). */
  nivelAlpha?: string;
  /** Áreas del panel que puede tocar; vacío = acceso total (TCK-8040 §7). */
  permisosAdmin?: string[];
}

/** Contadores de la cabecera de Comercios (TCK-8034). */
export interface ResumenComercios {
  total: number;
  activos: number;
  pendientes: number;
  suspendidos: number;
  verificados: number;
}

/** Reserva resumida tal y como sale en las fichas administrativas. */
export interface ReservaFicha {
  _id: string;
  codigo: string;
  vertical: string;
  estado: string;
  montoTotal: number;
  fechaInicio?: string;
  createdAt: string;
}

/** Ficha administrativa de una cuenta (TCK-8035 §5 y §6). */
export interface FichaUsuario {
  usuario: {
    _id: string; nombre: string; email: string; telefono?: string; rol: string;
    verificado: boolean; permisosAdmin: string[]; createdAt?: string;
  };
  comercio: { _id: string; nombreComercial: string; estado: string; plan: string } | null;
  mascotas: Array<{ nombre: string; raza?: string }>;
  reservas: ReservaFicha[];
  resumen: {
    totalReservas: number; canceladas: number; totalGastado: number;
    pagos: number; resenas: number; incidencias: number;
  };
}

/** Ficha administrativa de un comercio (TCK-8034). */
export interface FichaComercio {
  comercio: {
    _id: string; nombreComercial: string; razonSocial: string; vatNumber: string;
    estado: string; plan: string; verticales: string[];
    verificacion?: VerificacionComercio; createdAt?: string;
  };
  reservas: ReservaFicha[];
  resumen: {
    servicios: number; reservas: number; facturacion: number; comision: number;
    valoracion: number; resenas: number; equipo: number; incidencias: number;
  };
}

/** Contadores de la cabecera de Usuarios (TCK-8035). */
export interface ResumenUsuarios {
  total: number;
  clientes: number;
  comercios: number;
  administradores: number;
  nuevosMes: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface ReporteVertical {
  vertical: string;
  gmv: number;
  comision: number;
  costoStripe: number;
  margenNeto: number;
  totalReservas: number;
}

export interface ReporteFinanciero {
  fechaDesde: string;
  fechaHasta: string;
  gmv: number;
  ingresosPlataforma: number;
  costoStripe: number;
  margenNetoPlataforma: number;
  liquidacionesComercio: number;
  totalReservas: number;
  porVertical: ReporteVertical[];
}

export interface CrearComercioDto {
  razonSocial: string;
  vatNumber: string;
  nombreComercial: string;
  logoUrl?: string;
  verticales?: string[];
  plan?: string;
  estado?: string;
}

export interface ActualizarComercioDto {
  razonSocial?: string;
  nombreComercial?: string;
  logoUrl?: string;
  verticales?: string[];
  plan?: string;
  estado?: string;
  comisionPctOverride?: number;
}

export interface CrearUsuarioDto {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  rol?: string;
  comercioId?: string;
}

export interface ActualizarUsuarioDto {
  nombre?: string;
  email?: string;
  telefono?: string;
  rol?: string;
  verificado?: boolean;
  comercioId?: string;
  permisosAdmin?: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/admin`;
  private readonly comerciosUrl = `${environment.apiUrl}/comercios`;
  private readonly cuponesUrl = `${environment.apiUrl}/cupones`;

  getDashboard(rango?: { desde: string; hasta: string }): Observable<AdminDashboardResponse> {
    let p = new HttpParams();
    if (rango) p = p.set('desde', rango.desde).set('hasta', rango.hasta);
    return this.http.get<AdminDashboardResponse>(`${this.adminUrl}/dashboard`, { params: p });
  }

  getComisiones(): Observable<ComisionConfig[]> {
    return this.http.get<ComisionConfig[]>(`${this.adminUrl}/comisiones`);
  }

  updateComision(dto: { vertical: string; comisionPct: number; stripePct?: number; stripeFijoEur?: number; activo: boolean }): Observable<ComisionConfig> {
    return this.http.put<ComisionConfig>(`${this.adminUrl}/comisiones`, dto);
  }

  getAlphaNiveles(): Observable<AlphaNivel[]> {
    return this.http.get<AlphaNivel[]>(`${this.adminUrl}/alpha`);
  }

  updateAlphaNivel(dto: AlphaNivel): Observable<AlphaNivel> {
    return this.http.put<AlphaNivel>(`${this.adminUrl}/alpha`, dto);
  }

  aprobarComercio(id: string): Observable<unknown> {
    return this.http.patch(`${this.comerciosUrl}/${id}/estado`, { estado: 'activo' });
  }

  /** Suspender o rechazar exige motivo: el backend lo valida (TCK-8034). */
  rechazarComercio(id: string, motivo: string): Observable<unknown> {
    return this.http.patch(`${this.comerciosUrl}/${id}/estado`, { estado: 'suspendido', motivo });
  }

  getAuditoria(params: { page?: number; limite?: number; entidad?: string; entidadId?: string; buscar?: string } = {}): Observable<PaginatedResult<RegistroAuditoria>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limite) p = p.set('limite', String(params.limite));
    if (params.entidad) p = p.set('entidad', params.entidad);
    if (params.entidadId) p = p.set('entidadId', params.entidadId);
    if (params.buscar) p = p.set('buscar', params.buscar);
    return this.http.get<PaginatedResult<RegistroAuditoria>>(`${environment.apiUrl}/auditoria`, { params: p });
  }

  /** Alta o baja del comercio en el programa Doogking Alpha (HU-13.3). */
  fijarAlphaAdherido(id: string, alphaAdherido: boolean): Observable<ComercioAdmin> {
    return this.http.patch<ComercioAdmin>(`${this.comerciosUrl}/${id}/alpha-adherido`, { alphaAdherido });
  }

  cambiarVerificacionComercio(id: string, estado: 'verificado' | 'rechazado' | 'pendiente', motivo?: string): Observable<ComercioAdmin> {
    return this.http.patch<ComercioAdmin>(`${this.adminUrl}/comercios/${id}/verificacion`, { estado, motivo });
  }

  // ── Comercios CRUD ───────────────────────────────────────────────────────────

  getComercios(params: { page?: number; limite?: number; estado?: string; buscar?: string; alphaAdherido?: boolean } = {}): Observable<PaginatedResult<ComercioAdmin>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limite) p = p.set('limite', String(params.limite));
    if (params.estado) p = p.set('estado', params.estado);
    if (params.buscar) p = p.set('buscar', params.buscar);
    if (params.alphaAdherido !== undefined) p = p.set('alphaAdherido', String(params.alphaAdherido));
    return this.http.get<PaginatedResult<ComercioAdmin>>(`${this.adminUrl}/comercios`, { params: p });
  }

  crearComercio(dto: CrearComercioDto): Observable<ComercioAdmin> {
    return this.http.post<ComercioAdmin>(`${this.adminUrl}/comercios`, dto);
  }

  actualizarComercio(id: string, dto: ActualizarComercioDto): Observable<ComercioAdmin> {
    return this.http.patch<ComercioAdmin>(`${this.adminUrl}/comercios/${id}`, dto);
  }

  eliminarComercio(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/comercios/${id}`);
  }

  // ── Usuarios CRUD ────────────────────────────────────────────────────────────

  getUsuarios(params: { page?: number; limite?: number; rol?: string; buscar?: string; verificado?: boolean } = {}): Observable<PaginatedResult<UsuarioAdmin>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limite) p = p.set('limite', String(params.limite));
    if (params.rol) p = p.set('rol', params.rol);
    if (params.buscar) p = p.set('buscar', params.buscar);
    if (params.verificado !== undefined) p = p.set('verificado', String(params.verificado));
    return this.http.get<PaginatedResult<UsuarioAdmin>>(`${this.adminUrl}/usuarios`, { params: p });
  }

  getPagos(params: { page?: number; limite?: number; estado?: string; comercioId?: string; buscar?: string } = {}): Observable<PaginatedResult<PagoAdmin>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limite) p = p.set('limite', String(params.limite));
    if (params.estado) p = p.set('estado', params.estado);
    if (params.comercioId) p = p.set('comercioId', params.comercioId);
    if (params.buscar) p = p.set('buscar', params.buscar);
    return this.http.get<PaginatedResult<PagoAdmin>>(`${this.adminUrl}/pagos`, { params: p });
  }

  getLiquidaciones(params: { page?: number; limite?: number; comercioId?: string; estado?: string } = {}): Observable<PaginatedResult<Liquidacion>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limite) p = p.set('limite', String(params.limite));
    if (params.comercioId) p = p.set('comercioId', params.comercioId);
    if (params.estado) p = p.set('estado', params.estado);
    return this.http.get<PaginatedResult<Liquidacion>>(`${environment.apiUrl}/liquidaciones`, { params: p });
  }

  generarLiquidacion(dto: { comercioId: string; desde: string; hasta: string }): Observable<Liquidacion> {
    return this.http.post<Liquidacion>(`${environment.apiUrl}/liquidaciones`, dto);
  }

  marcarLiquidacionPagada(id: string, referencia: string): Observable<Liquidacion> {
    return this.http.patch<Liquidacion>(`${environment.apiUrl}/liquidaciones/${id}/pagada`, { referencia });
  }

  getResumenPagos(): Observable<ResumenPagos> {
    return this.http.get<ResumenPagos>(`${this.adminUrl}/pagos/resumen`);
  }

  getResumenReservas(): Observable<ResumenReservas> {
    return this.http.get<ResumenReservas>(`${this.adminUrl}/reservas/resumen`);
  }

  getResumenComercios(): Observable<ResumenComercios> {
    return this.http.get<ResumenComercios>(`${this.adminUrl}/comercios/resumen`);
  }

  getFichaUsuario(id: string): Observable<FichaUsuario> {
    return this.http.get<FichaUsuario>(`${this.adminUrl}/usuarios/${id}/ficha`);
  }

  getFichaComercio(id: string): Observable<FichaComercio> {
    return this.http.get<FichaComercio>(`${this.adminUrl}/comercios/${id}/ficha`);
  }

  getResumenUsuarios(): Observable<ResumenUsuarios> {
    return this.http.get<ResumenUsuarios>(`${this.adminUrl}/usuarios/resumen`);
  }

  crearUsuario(dto: CrearUsuarioDto): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(`${this.adminUrl}/usuarios`, dto);
  }

  actualizarUsuario(id: string, dto: ActualizarUsuarioDto): Observable<UsuarioAdmin> {
    return this.http.patch<UsuarioAdmin>(`${this.adminUrl}/usuarios/${id}`, dto);
  }

  eliminarUsuario(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/usuarios/${id}`);
  }

  // ── Reservas ─────────────────────────────────────────────────────────────────

  getAnalitica(): Observable<AnaliticaAdmin> {
    return this.http.get<AnaliticaAdmin>(`${this.adminUrl}/analitica`);
  }

  getReservas(page = 1, filtros: FiltrosReservasAdmin = {}): Observable<PaginatedResult<ReservaAdmin>> {
    let params = new HttpParams().set('page', String(page));
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.comercioId) params = params.set('comercioId', filtros.comercioId);
    if (filtros.buscar) params = params.set('buscar', filtros.buscar);
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    return this.http.get<PaginatedResult<ReservaAdmin>>(`${this.adminUrl}/reservas`, { params });
  }

  cambiarEstadoReserva(id: string, estado: string, motivo?: string): Observable<ReservaAdmin> {
    return this.http.patch<ReservaAdmin>(`${this.adminUrl}/reservas/${id}/estado`, { estado, motivo });
  }

  // ── Cupones ──────────────────────────────────────────────────────────────────

  actualizarCupon(id: string, datos: Record<string, unknown>): Observable<unknown> {
    return this.http.patch(`${this.cuponesUrl}/${id}`, datos);
  }

  eliminarCupon(id: string): Observable<void> {
    return this.http.delete<void>(`${this.cuponesUrl}/${id}`);
  }

  // ── Reportes ─────────────────────────────────────────────────────────────────

  getReporteFinanciero(
    desde: string,
    hasta: string,
    vertical?: string,
    comercioId?: string,
  ): Observable<ReporteFinanciero> {
    let params = new HttpParams().set('fechaDesde', desde).set('fechaHasta', hasta);
    if (vertical) params = params.set('vertical', vertical);
    if (comercioId) params = params.set('comercioId', comercioId);
    return this.http.get<ReporteFinanciero>(`${this.adminUrl}/reportes/financiero`, { params });
  }
}
