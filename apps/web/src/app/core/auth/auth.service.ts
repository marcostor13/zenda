import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LoginDto, RegistroDto, AuthResponseDto, Rol } from 'shared';
import { environment } from '../../../environments/environment';

interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

const TOKEN_KEY = 'reservalo_token';

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
    await this.router.navigate(['/buscador']);
  }

  async registro(dto: RegistroDto): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<AuthResponseDto>(`${environment.apiUrl}/auth/registro`, dto),
    );
    this.guardarSesion(respuesta);
    await this.router.navigate(['/buscador']);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('reservalo_usuario');
    this._usuario.set(null);
    this._token.set(null);
    void this.router.navigate(['/auth/login']);
  }

  private guardarSesion(respuesta: AuthResponseDto): void {
    localStorage.setItem(TOKEN_KEY, respuesta.accessToken);
    localStorage.setItem('reservalo_usuario', JSON.stringify(respuesta.usuario));
    this._token.set(respuesta.accessToken);
    this._usuario.set(respuesta.usuario);
  }

  private cargarUsuarioDelStorage(): UsuarioAutenticado | null {
    const datos = localStorage.getItem('reservalo_usuario');
    return datos ? (JSON.parse(datos) as UsuarioAutenticado) : null;
  }
}
