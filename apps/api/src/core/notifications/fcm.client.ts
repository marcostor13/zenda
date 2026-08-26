import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT } from 'google-auth-library';

/** Permiso mínimo para enviar mensajes; no da acceso a nada más del proyecto. */
const AMBITO_FCM = 'https://www.googleapis.com/auth/firebase.messaging';

export interface MensajePush {
  titulo: string;
  cuerpo: string;
  /** Ruta de la app que se abre al tocar la notificación. */
  ruta?: string;
}

/** Por qué no se entregó, para decidir si el token sigue sirviendo. */
export type ResultadoEnvio = 'entregado' | 'token_invalido' | 'error';

/**
 * Cliente de Firebase Cloud Messaging (API HTTP v1).
 *
 * Sustituye a la API antigua (`fcm.googleapis.com/fcm/send` con
 * `Authorization: key=…`), que **Google apagó el 20 de junio de 2024**. Todo
 * envío por esa vía responde 404 desde entonces, así que las push de la
 * plataforma no habrían salido nunca aunque hubiera credenciales.
 *
 * La v1 se autentica con una cuenta de servicio: se firma un JWT y se
 * intercambia por un token de acceso de una hora. `google-auth-library` guarda
 * ese token y lo renueva sola, así que no hay que cachearlo aquí.
 */
@Injectable()
export class FcmClient {
  private readonly logger = new Logger(FcmClient.name);
  private readonly proyectoId?: string;
  private readonly jwt?: JWT;

  constructor(config: ConfigService) {
    this.proyectoId = config.get<string>('FCM_PROJECT_ID');
    const email = config.get<string>('FCM_CLIENT_EMAIL');
    const clave = normalizarClave(config.get<string>('FCM_PRIVATE_KEY'));

    if (!this.proyectoId || !email || !clave) {
      this.logger.warn(
        'FCM sin configurar (FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY). '
        + 'Los dispositivos se registran igual; el envío queda desactivado.',
      );
      return;
    }

    this.jwt = new JWT({ email, key: clave, scopes: [AMBITO_FCM] });
  }

  get estaConfigurado(): boolean {
    return Boolean(this.jwt && this.proyectoId);
  }

  /**
   * Envía a un token. **Nunca lanza**: distingue entre un token que ya no vale
   * —hay que darlo de baja— y un fallo pasajero, que no debe borrar nada.
   */
  async enviar(token: string, mensaje: MensajePush): Promise<ResultadoEnvio> {
    if (!this.jwt || !this.proyectoId) return 'error';

    try {
      const respuesta = await this.jwt.request<unknown>({
        url: `https://fcm.googleapis.com/v1/projects/${this.proyectoId}/messages:send`,
        method: 'POST',
        data: { message: this.construirMensaje(token, mensaje) },
      });

      return respuesta.status === 200 ? 'entregado' : 'error';
    } catch (error) {
      return this.interpretarFallo(error);
    }
  }

  /**
   * `data` va con todo en texto: FCM rechaza el mensaje si algún valor de
   * `data` no es string, y un `undefined` colado ahí tumbaría el envío entero.
   */
  private construirMensaje(token: string, mensaje: MensajePush): Record<string, unknown> {
    return {
      token,
      notification: { title: mensaje.titulo, body: mensaje.cuerpo },
      data: { ruta: mensaje.ruta ?? '/' },
      android: {
        priority: 'high',
        notification: { channel_id: 'doogking-avisos', default_sound: true },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };
  }

  /**
   * FCM responde 404 (`UNREGISTERED`) cuando la app se desinstaló y 400
   * (`INVALID_ARGUMENT`) cuando el token está mal formado. En los dos casos ese
   * token ya no sirve. El resto —cortes de red, 5xx, cuota— son pasajeros y no
   * deben dar de baja a nadie.
   */
  private interpretarFallo(error: unknown): ResultadoEnvio {
    const estado = (error as { response?: { status?: number } })?.response?.status;

    if (estado === 404 || estado === 400) return 'token_invalido';

    const mensaje = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Envío push fallido (estado ${estado ?? 'desconocido'}): ${mensaje}`);
    return 'error';
  }
}

/**
 * Las claves privadas se pegan en variables de entorno con los saltos de línea
 * escapados (`\n` literal). Sin deshacer ese escapado la firma del JWT falla
 * con un error de formato que no dice nada útil.
 */
const normalizarClave = (clave?: string): string | undefined =>
  clave?.replace(/\\n/g, '\n').trim() || undefined;
