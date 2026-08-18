import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Dispositivo, DispositivoDocument, PlataformaDispositivo } from './dispositivo.schema';

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

export interface EnvioPush {
  titulo: string;
  cuerpo: string;
  /** Ruta de la aplicación a abrir al tocar la notificación. */
  ruta?: string;
}

export interface ResultadoPush {
  enviados: number;
  desactivados: number;
  /** true cuando no hay proveedor configurado y no se envió nada. */
  omitido: boolean;
}

/**
 * Envío de notificaciones push.
 *
 * El registro de dispositivos funciona **siempre**; el envío requiere
 * `FCM_SERVER_KEY`. Separarlos permite que la app móvil registre tokens desde
 * el primer día y que el envío se active cuando existan las credenciales, sin
 * volver a tocar el cliente.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly serverKey?: string;

  constructor(
    @InjectModel(Dispositivo.name) private readonly dispositivoModel: Model<DispositivoDocument>,
    config: ConfigService,
  ) {
    this.serverKey = config.get<string>('FCM_SERVER_KEY');
  }

  get estaConfigurado(): boolean {
    return Boolean(this.serverKey);
  }

  /** Alta idempotente: reinstalar la app no duplica el dispositivo. */
  async registrar(
    usuarioId: string,
    token: string,
    plataforma: PlataformaDispositivo,
  ): Promise<DispositivoDocument> {
    return this.dispositivoModel
      .findOneAndUpdate(
        { token },
        {
          $set: {
            usuarioId: new Types.ObjectId(usuarioId),
            plataforma,
            // Reactiva un dispositivo que se había desactivado por rechazo.
            activo: true,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  async darDeBaja(token: string): Promise<void> {
    await this.dispositivoModel.deleteOne({ token }).exec();
  }

  /**
   * Envía a todos los dispositivos activos del usuario. **Nunca lanza**: una
   * push fallida no puede tumbar el flujo que la originó.
   *
   * La promesa hay que devolverla ya resuelta de verdad, no sólo prometerlo en
   * el comentario: se llama con `void` desde `GrowthService`, así que un rechazo
   * aquí sería un *unhandled rejection* y, en Node ≥ 15, el proceso se cae.
   * `new Types.ObjectId(usuarioId)` con un id mal formado y cualquier fallo de
   * Mongo entran por esa puerta.
   */
  async enviarA(usuarioId: string, envio: EnvioPush): Promise<ResultadoPush> {
    try {
      return await this.enviarADispositivos(usuarioId, envio);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`Push no enviada a ${usuarioId}: ${mensaje}`);
      return { enviados: 0, desactivados: 0, omitido: true };
    }
  }

  private async enviarADispositivos(usuarioId: string, envio: EnvioPush): Promise<ResultadoPush> {
    const dispositivos = await this.dispositivoModel
      .find({ usuarioId: new Types.ObjectId(usuarioId), activo: true })
      .select('token')
      .lean()
      .exec();

    if (!dispositivos.length) return { enviados: 0, desactivados: 0, omitido: false };

    if (!this.estaConfigurado) {
      this.logger.debug('Push omitida: FCM_SERVER_KEY no configurada.');
      return { enviados: 0, desactivados: 0, omitido: true };
    }

    let enviados = 0;
    let desactivados = 0;

    for (const dispositivo of dispositivos) {
      const entregada = await this.enviarUno(dispositivo.token, envio);
      if (entregada) {
        enviados++;
        continue;
      }
      // Token rechazado: se desactiva en vez de borrarlo, para conservar el
      // rastro de que ese dispositivo existió.
      await this.dispositivoModel.updateOne({ token: dispositivo.token }, { $set: { activo: false } }).exec();
      desactivados++;
    }

    return { enviados, desactivados, omitido: false };
  }

  private async enviarUno(token: string, envio: EnvioPush): Promise<boolean> {
    try {
      const respuesta = await fetch(FCM_URL, {
        method: 'POST',
        headers: {
          Authorization: `key=${this.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: { title: envio.titulo, body: envio.cuerpo },
          data: { ruta: envio.ruta ?? '/' },
        }),
      });

      if (!respuesta.ok) return false;

      const datos = (await respuesta.json()) as { success?: number };
      return (datos.success ?? 0) > 0;
    } catch (error) {
      this.logger.warn(`Push no entregada: ${error}`);
      return false;
    }
  }
}
