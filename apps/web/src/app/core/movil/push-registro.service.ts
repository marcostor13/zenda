import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

/** En qué punto está el permiso de notificaciones de este dispositivo. */
export type EstadoPermisoPush = 'desconocido' | 'concedido' | 'denegado' | 'no_disponible';

@Injectable({ providedIn: 'root' })
export class PushRegistroService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly permiso = signal<EstadoPermisoPush>('desconocido');
  /** Token del dispositivo, para poder darlo de baja al cerrar sesión. */
  private token: string | null = null;

  /**
   * Prepara las push del dispositivo.
   *
   * **No pide el permiso aquí.** Pedirlo nada más abrir la app por primera vez
   * es la forma más rápida de que lo denieguen para siempre: en Android e iOS
   * el rechazo es definitivo y sólo se revierte desde los ajustes del sistema.
   * Se registran los oyentes y se pide desde `solicitarPermiso()`, cuando ya
   * hay un motivo que enseñar (tras reservar, o desde el perfil).
   */
  async iniciar(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.permiso.set('no_disponible');
      return;
    }

    await this.registrarOyentes();

    const { receive } = await PushNotifications.checkPermissions();
    this.permiso.set(traducirPermiso(receive));

    // Ya concedido de una sesión anterior: se re-registra, porque el token
    // puede haber cambiado (reinstalación, restauración, limpieza de datos).
    if (this.permiso() === 'concedido') {
      await PushNotifications.register();
    }
  }

  /**
   * Pide el permiso al sistema. Devuelve si quedó concedido.
   *
   * Llamar a esto con el permiso ya denegado no vuelve a mostrar el diálogo:
   * el sistema responde que no directamente, y hay que mandar al usuario a los
   * ajustes. Por eso se distingue `denegado` de `desconocido`.
   */
  async solicitarPermiso(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;

    const { receive } = await PushNotifications.requestPermissions();
    this.permiso.set(traducirPermiso(receive));

    if (this.permiso() !== 'concedido') return false;

    await PushNotifications.register();
    return true;
  }

  /**
   * Da de baja el dispositivo. Se llama al cerrar sesión: si no, las
   * notificaciones del usuario anterior seguirían llegando a ese móvil.
   */
  async darDeBaja(): Promise<void> {
    if (!this.token) return;

    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/push/dispositivos/${encodeURIComponent(this.token)}`),
      );
    } catch {
      // El servidor acabará dando el token por inválido al primer rechazo de
      // la pasarela; no merece la pena bloquear el cierre de sesión por esto.
    }
    this.token = null;
  }

  private async registrarOyentes(): Promise<void> {
    // Se limpian antes de añadir: `iniciar()` puede correr otra vez tras un
    // login y los oyentes duplicados registrarían el token dos veces.
    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener('registration', (token) => {
      this.token = token.value;
      void this.enviarToken(token.value);
    });

    await PushNotifications.addListener('registrationError', () => {
      // Sin token no hay push, pero la app funciona igual: no se avisa de nada.
      this.permiso.set('no_disponible');
    });

    // Notificación tocada: se abre la pantalla que indique el mensaje.
    await PushNotifications.addListener('pushNotificationActionPerformed', (accion) => {
      const ruta = accion.notification.data?.['ruta'];
      if (typeof ruta === 'string' && ruta.startsWith('/')) {
        void this.router.navigateByUrl(ruta);
      }
    });
  }

  /**
   * El token se guarda contra el usuario autenticado. Sin sesión no se manda:
   * el API lo rechazaría, y se reintenta en cuanto `iniciar()` vuelva a correr
   * tras el login.
   */
  private async enviarToken(token: string): Promise<void> {
    if (!this.auth.estaAutenticado()) return;

    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/push/dispositivos`, {
          token,
          plataforma: Capacitor.getPlatform(),
        }),
      );
    } catch {
      // Un fallo de red aquí no rompe nada: el token se reenvía en el
      // siguiente arranque, porque el registro se repite en cada `iniciar()`.
    }
  }
}

/** El plugin devuelve el vocabulario del sistema; aquí se traduce al del dominio. */
const traducirPermiso = (estado: string): EstadoPermisoPush => {
  if (estado === 'granted') return 'concedido';
  if (estado === 'denied') return 'denegado';
  return 'desconocido';
};
