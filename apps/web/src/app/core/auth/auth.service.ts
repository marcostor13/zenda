import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LoginDto, RegistroDto, RegistroComercioDto, AuthResponseDto, Rol } from 'shared';
import { environment } from '../../../environments/environment';

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  comercioId?: string;
}

const TOKEN_KEY = 'zenda_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _usuario = signal<UsuarioAutenticado | null>(this.cargarUsuarioDelStorage());
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly usuario = this._usuario.asReadonly();
  readonly token = this._token.asReadonly();
  readonly estaAutenticado = computed(() => this._usuario() !== null);
  readonly esAdmin = computed(() => this._usuario()?.rol === Rol.ADMIN);
  readonly esComercio = computed(
    () =>
      this._usuario()?.rol === Rol.COMERCIO_ADMIN || this._usuario()?.rol === Rol.COMERCIO_STAFF,
  );

  async login(dto: LoginDto): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<AuthResponseDto>(`${environment.apiUrl}/auth/login`, dto),
    );
    this.guardarSesion(respuesta);
    await this.redirigirPorRol(respuesta.usuario.rol);
  }

  async registro(dto: RegistroDto): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<AuthResponseDto>(`${environment.apiUrl}/auth/registro`, dto),
    );
    this.guardarSesion(respuesta);
    await this.redirigirPorRol(respuesta.usuario.rol);
  }

  /** Alta de comercio en un solo paso (cuenta comercio_admin + negocio). */
  async registrarComercio(dto: RegistroComercioDto): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<AuthResponseDto>(`${environment.apiUrl}/comercios/registro`, dto),
    );
    this.guardarSesion(respuesta);
    await this.redirigirPorRol(respuesta.usuario.rol);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('zenda_usuario');
    this._usuario.set(null);
    this._token.set(null);
    void this.router.navigate(['/auth/login']);
  }

  /** Aplica una sesión ya emitida por el backend (p. ej. tras vincular un comercio). */
  aplicarSesion(respuesta: AuthResponseDto): void {
    this.guardarSesion(respuesta);
  }

  actualizarDatosLocales(datos: Partial<UsuarioAutenticado>): void {
    const actual = this._usuario();
    if (!actual) return;
    const actualizado = { ...actual, ...datos };
    localStorage.setItem('zenda_usuario', JSON.stringify(actualizado));
    this._usuario.set(actualizado);
  }

  private async redirigirPorRol(rol: Rol): Promise<void> {
    if (rol === Rol.ADMIN) {
      await this.router.navigate(['/admin']);
    } else if (rol === Rol.COMERCIO_ADMIN || rol === Rol.COMERCIO_STAFF) {
      await this.router.navigate(['/comercio']);
    } else {
      await this.router.navigate(['/']);
    }
  }

  private guardarSesion(respuesta: AuthResponseDto): void {
    localStorage.setItem(TOKEN_KEY, respuesta.accessToken);
    localStorage.setItem('zenda_usuario', JSON.stringify(respuesta.usuario));
    this._token.set(respuesta.accessToken);
    this._usuario.set(respuesta.usuario as UsuarioAutenticado);
  }

  private cargarUsuarioDelStorage(): UsuarioAutenticado | null {
    const datos = localStorage.getItem('zenda_usuario');
    return datos ? (JSON.parse(datos) as UsuarioAutenticado) : null;
  }
}
