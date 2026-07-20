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
}

export interface ComisionConfig {
  _id: string;
  vertical: string;
  comisionPct: number;
  stripePct: number;
  stripeFijoEur: number;
  activo: boolean;
}

export interface AdminDashboardResponse {
  kpis: DashboardKpis;
  comerciosPendientes: ComercioPendiente[];
  ultimasReservas: UltimaReserva[];
  comisiones: ComisionConfig[];
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
}

export interface ReservaAdmin {
  _id: string;
  codigo: string;
  vertical: string;
  montoTotal: number;
  estado: string;
  fechaInicio?: string;
  createdAt: string;
}

export interface UsuarioAdmin {
  _id: string;
  nombre: string;
  email: string;
  rol: string;
  verificado: boolean;
  telefono?: string;
  createdAt: string;
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
}

export interface ActualizarUsuarioDto {
  nombre?: string;
  email?: string;
  telefono?: string;
  rol?: string;
  verificado?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/admin`;
  private readonly comerciosUrl = `${environment.apiUrl}/comercios`;
  private readonly cuponesUrl = `${environment.apiUrl}/cupones`;

  getDashboard(): Observable<AdminDashboardResponse> {
    return this.http.get<AdminDashboardResponse>(`${this.adminUrl}/dashboard`);
  }

  updateComision(dto: { vertical: string; comisionPct: number; stripePct?: number; stripeFijoEur?: number; activo: boolean }): Observable<ComisionConfig> {
    return this.http.put<ComisionConfig>(`${this.adminUrl}/comisiones`, dto);
  }

  aprobarComercio(id: string): Observable<unknown> {
    return this.http.patch(`${this.comerciosUrl}/${id}/estado`, { estado: 'activo' });
  }

  rechazarComercio(id: string): Observable<unknown> {
    return this.http.patch(`${this.comerciosUrl}/${id}/estado`, { estado: 'suspendido' });
  }

  // ── Comercios CRUD ───────────────────────────────────────────────────────────

  getComercios(params: { page?: number; limite?: number; estado?: string; buscar?: string } = {}): Observable<PaginatedResult<ComercioAdmin>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limite) p = p.set('limite', String(params.limite));
    if (params.estado) p = p.set('estado', params.estado);
    if (params.buscar) p = p.set('buscar', params.buscar);
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

  getUsuarios(params: { page?: number; limite?: number; rol?: string; buscar?: string } = {}): Observable<PaginatedResult<UsuarioAdmin>> {
    let p = new HttpParams();
    if (params.page) p = p.set('page', String(params.page));
    if (params.limite) p = p.set('limite', String(params.limite));
    if (params.rol) p = p.set('rol', params.rol);
    if (params.buscar) p = p.set('buscar', params.buscar);
    return this.http.get<PaginatedResult<UsuarioAdmin>>(`${this.adminUrl}/usuarios`, { params: p });
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

  getReservas(page = 1, estado?: string): Observable<PaginatedResult<ReservaAdmin>> {
    let params = new HttpParams().set('page', String(page));
    if (estado) params = params.set('estado', estado);
    return this.http.get<PaginatedResult<ReservaAdmin>>(`${this.adminUrl}/reservas`, { params });
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
