import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthResponseDto, IniciarInvitadoDto } from 'shared';
import { environment } from '../../../environments/environment';
import { almacenSesion } from '../plataforma/almacen';

export const CLAVE_SESION_INVITADO = 'doogking_invitado';

/** Algo menos que las 6 h del API: mejor pedir otra que usar una a punto de caducar. */
const VIGENCIA_MS = 5.5 * 60 * 60 * 1000;

interface SesionGuardada {
  token: string;
  email: string;
  nombre: string;
  expiraEn: number;
}

/**
 * Sesión para reservar sin cuenta.
 *
 * Va aparte de `AuthService` a propósito: quien reserva como invitado no ha
 * iniciado sesión. Si compartiera la sesión normal, la cabecera pintaría un
 * avatar, los guards abrirían «Mis reservas» y la cuenta parecería real. Aquí
 * sólo vive el token que el interceptor manda al API cuando no hay sesión.
 *
 * Se guarda en `sessionStorage`: sobrevive a la vuelta de la pasarela de pago
 * (misma pestaña) y desaparece al cerrarla, que es lo que debe durar.
 */
@Injectable({ providedIn: 'root' })
export class SesionInvitadoService {
  private readonly http = inject(HttpClient);
  private readonly sesion = signal<SesionGuardada | null>(this.leer());

  readonly activa = computed(() => this.sesion() !== null);
  readonly email = computed(() => this.sesion()?.email ?? null);

  /** Token vigente, o null si no hay o ya caducó. */
  token(): string | null {
    const actual = this.sesion();
    if (!actual) return null;
    if (actual.expiraEn <= Date.now()) {
      this.cerrar();
      return null;
    }
    return actual.token;
  }

  /**
   * Abre (o reutiliza) la sesión para ese email. Si ya hay una vigente con el
   * mismo correo no se pide otra: el asistente puede llamar aquí cada vez que
   * se avanza al pago.
   */
  async iniciar(datos: IniciarInvitadoDto): Promise<void> {
    const email = datos.email.trim().toLowerCase();
    if (this.token() && this.sesion()?.email === email) return;

    const respuesta = await firstValueFrom(
      this.http.post<AuthResponseDto>(`${environment.apiUrl}/auth/invitado`, { ...datos, email }),
    );
    this.guardar({
      token: respuesta.accessToken,
      email,
      nombre: respuesta.usuario.nombre,
      expiraEn: Date.now() + VIGENCIA_MS,
    });
  }

  cerrar(): void {
    almacenSesion().removeItem(CLAVE_SESION_INVITADO);
    this.sesion.set(null);
  }

  private guardar(sesion: SesionGuardada): void {
    almacenSesion().setItem(CLAVE_SESION_INVITADO, JSON.stringify(sesion));
    this.sesion.set(sesion);
  }

  private leer(): SesionGuardada | null {
    try {
      const datos = almacenSesion().getItem(CLAVE_SESION_INVITADO);
      const sesion = datos ? (JSON.parse(datos) as SesionGuardada) : null;
      return sesion && sesion.expiraEn > Date.now() ? sesion : null;
    } catch {
      return null;
    }
  }
}
