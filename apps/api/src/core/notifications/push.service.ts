import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Dispositivo, DispositivoDocument, PlataformaDispositivo } from './dispositivo.schema';
import { FcmClient, MensajePush } from './fcm.client';

export type EnvioPush = MensajePush;

export interface ResultadoPush {
  enviados: number;
  desactivados: number;
  /** true cuando no hay proveedor configurado y no se envió nada. */
  omitido: boolean;
}

/** A quién va dirigido un envío del panel de administración. */
export interface DestinatariosPush {
  /** Roles a los que llega; vacío = a todos los que tengan la app. */
  roles?: string[];
  /** Usuarios concretos. Tiene prioridad sobre `roles`. */
  usuarioIds?: string[];
}

/** Cuántos dispositivos se procesan a la vez en un envío masivo. */
const TAMANO_LOTE = 25;

/**
 * Envío de notificaciones push.
 *
 * El registro de dispositivos funciona **siempre**; el envío requiere las
 * credenciales de FCM. Separarlos permite que la app móvil registre tokens
 * desde el primer día y que el envío se active cuando existan las
 * credenciales, sin volver a tocar el cliente.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectModel(Dispositivo.name) private readonly dispositivoModel: Model<DispositivoDocument>,
    private readonly fcm: FcmClient,
  ) {}

  get estaConfigurado(): boolean {
    return this.fcm.estaConfigurado;
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
   * el comentario: se llama con `void` desde otros servicios, así que un
   * rechazo aquí sería un *unhandled rejection* y, en Node ≥ 15, el proceso se
   * cae.
   */
  async enviarA(usuarioId: string, envio: EnvioPush): Promise<ResultadoPush> {
    try {
      const dispositivos = await this.dispositivoModel
        .find({ usuarioId: new Types.ObjectId(usuarioId), activo: true })
        .select('token')
        .lean()
        .exec();

      return await this.repartir(dispositivos.map((d) => d.token), envio);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'error desconocido';
      this.logger.error(`Push no enviada a ${usuarioId}: ${mensaje}`);
      return { enviados: 0, desactivados: 0, omitido: true };
    }
  }

  /**
   * Envío masivo desde el panel de administración.
   *
   * Recorre en lotes en vez de cargar todos los tokens en memoria y disparar a
   * la vez: una base con miles de dispositivos tumbaría el proceso y FCM
   * cortaría por exceso de peticiones simultáneas.
   */
  async enviarAVarios(destinatarios: DestinatariosPush, envio: EnvioPush): Promise<ResultadoPush> {
    if (!this.estaConfigurado) {
      return { enviados: 0, desactivados: 0, omitido: true };
    }

    const filtro = await this.construirFiltro(destinatarios);
    const total = { enviados: 0, desactivados: 0 };

    for (let saltar = 0; ; saltar += TAMANO_LOTE) {
      const lote = await this.dispositivoModel
        .find(filtro)
        .select('token')
        .skip(saltar)
        .limit(TAMANO_LOTE)
        .lean()
        .exec();

      if (!lote.length) break;

      const parcial = await this.repartir(lote.map((d) => d.token), envio);
      total.enviados += parcial.enviados;
      total.desactivados += parcial.desactivados;

      if (lote.length < TAMANO_LOTE) break;
    }

    this.logger.log(`Envío masivo: ${total.enviados} entregadas, ${total.desactivados} tokens dados de baja.`);
    return { ...total, omitido: false };
  }

  /** Cuántos dispositivos hay disponibles para un destinatario, sin enviar nada. */
  async contarDestinatarios(destinatarios: DestinatariosPush): Promise<number> {
    return this.dispositivoModel.countDocuments(await this.construirFiltro(destinatarios)).exec();
  }

  private async construirFiltro(destinatarios: DestinatariosPush): Promise<Record<string, unknown>> {
    const filtro: Record<string, unknown> = { activo: true };

    if (destinatarios.usuarioIds?.length) {
      filtro['usuarioId'] = { $in: destinatarios.usuarioIds.map((id) => new Types.ObjectId(id)) };
      return filtro;
    }

    if (destinatarios.roles?.length) {
      // Los roles viven en `usuarios`, no en `dispositivos`: se resuelven a ids
      // antes de filtrar para no tener que duplicar el rol en cada dispositivo,
      // donde quedaría desactualizado en cuanto alguien cambiara de rol.
      const usuarios = await this.dispositivoModel.db
        .collection('usuarios')
        .find({ rol: { $in: destinatarios.roles } }, { projection: { _id: 1 } })
        .toArray();

      filtro['usuarioId'] = { $in: usuarios.map((u) => u._id) };
    }

    return filtro;
  }

  /** Envía a una lista de tokens y da de baja los que la pasarela rechaza. */
  private async repartir(tokens: string[], envio: EnvioPush): Promise<ResultadoPush> {
    if (!tokens.length) return { enviados: 0, desactivados: 0, omitido: false };

    if (!this.estaConfigurado) {
      this.logger.debug('Push omitida: FCM no configurado.');
      return { enviados: 0, desactivados: 0, omitido: true };
    }

    const resultados = await Promise.all(
      tokens.map(async (token) => ({ token, resultado: await this.fcm.enviar(token, envio) })),
    );

    const invalidos = resultados.filter((r) => r.resultado === 'token_invalido').map((r) => r.token);

    if (invalidos.length) {
      // Se desactivan en vez de borrarlos, para conservar el rastro de que ese
      // dispositivo existió. Un fallo pasajero no llega aquí.
      await this.dispositivoModel
        .updateMany({ token: { $in: invalidos } }, { $set: { activo: false } })
        .exec();
    }

    const enviados = resultados.filter((r) => r.resultado === 'entregado').length;

    if (enviados) {
      await this.dispositivoModel
        .updateMany({ token: { $in: tokens } }, { $set: { ultimoEnvio: new Date() } })
        .exec();
    }

    return { enviados, desactivados: invalidos.length, omitido: false };
  }
}
