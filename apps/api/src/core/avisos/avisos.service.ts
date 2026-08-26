import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReservaEstado } from 'shared';
import { PushService, DestinatariosPush } from '../notifications/push.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  AvisoProgramado, AvisoProgramadoDocument, DisparadorAviso, SegmentoAviso,
} from './aviso-programado.schema';

/** Roles a los que llega cada segmento del panel. */
const ROLES_POR_SEGMENTO: Record<SegmentoAviso, string[] | undefined> = {
  todos: undefined,
  clientes: ['cliente'],
  comercios: ['comercio_admin', 'comercio_staff'],
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface ResultadoAviso {
  enviados: number;
  destinatarios: number;
  omitido: boolean;
}

/**
 * Avisos automáticos: recordatorios de pago, membresías por vencer, reservas
 * próximas y difusiones.
 *
 * El cron corre **cada minuto** y decide qué toca comparando la hora de cada
 * aviso con la actual. La alternativa —registrar un cron por aviso— obligaría
 * a rehacer los temporizadores cada vez que el administrador cambia una hora,
 * y un fallo ahí dejaría avisos que no vuelven a salir nunca sin que se note.
 */
@Injectable()
export class AvisosService {
  private readonly logger = new Logger(AvisosService.name);

  constructor(
    @InjectModel(AvisoProgramado.name) private readonly avisoModel: Model<AvisoProgramadoDocument>,
    private readonly pushService: PushService,
  ) {}

  // ─── Configuración (panel de administración) ───

  listar(): Promise<AvisoProgramadoDocument[]> {
    return this.avisoModel.find().sort({ createdAt: -1 }).exec();
  }

  /**
   * `async` a propósito: `validarHora` lanza, y en un método que promete una
   * `Promise` ese fallo debe llegar como rechazo. Lanzándolo de forma síncrona,
   * quien lo llame con `.catch()` no lo recogería.
   */
  async crear(datos: Partial<AvisoProgramado>, adminId: string): Promise<AvisoProgramadoDocument> {
    this.validarHora(datos.hora);
    return this.avisoModel.create({ ...datos, actualizadoPor: new Types.ObjectId(adminId) });
  }

  async actualizar(
    id: string,
    datos: Partial<AvisoProgramado>,
    adminId: string,
  ): Promise<AvisoProgramadoDocument> {
    this.validarHora(datos.hora);

    const aviso = await this.avisoModel
      .findByIdAndUpdate(
        id,
        { $set: { ...datos, actualizadoPor: new Types.ObjectId(adminId) } },
        { new: true },
      )
      .exec();

    if (!aviso) throw new DomainException('Aviso programado no encontrado', 404);
    return aviso;
  }

  async eliminar(id: string): Promise<void> {
    const borrado = await this.avisoModel.findByIdAndDelete(id).exec();
    if (!borrado) throw new DomainException('Aviso programado no encontrado', 404);
  }

  // ─── Envío ───

  /** Envío inmediato desde el panel, sin programar nada. */
  async enviarAhora(
    segmento: SegmentoAviso,
    mensaje: { titulo: string; cuerpo: string; ruta?: string },
    usuarioIds?: string[],
  ): Promise<ResultadoAviso> {
    const destinatarios = this.destinatariosDe(segmento, usuarioIds);
    const total = await this.pushService.contarDestinatarios(destinatarios);
    const resultado = await this.pushService.enviarAVarios(destinatarios, mensaje);

    return { enviados: resultado.enviados, destinatarios: total, omitido: resultado.omitido };
  }

  /** Dispara un aviso configurado sin esperar a su hora. Sirve para probarlo. */
  async ejecutarAhora(id: string): Promise<ResultadoAviso> {
    const aviso = await this.avisoModel.findById(id).exec();
    if (!aviso) throw new DomainException('Aviso programado no encontrado', 404);
    return this.ejecutar(aviso);
  }

  /**
   * Barrido de cada minuto. **Nunca lanza**: un aviso que falle no puede
   * impedir que salgan los demás ni tumbar el proceso del servidor.
   */
  @Cron('0 * * * * *')
  async revisarProgramados(): Promise<void> {
    const ahora = new Date();
    const hora = `${dosDigitos(ahora.getHours())}:${dosDigitos(ahora.getMinutes())}`;

    const pendientes = await this.avisoModel.find({ activo: true, hora }).exec();

    for (const aviso of pendientes) {
      if (!this.tocaHoy(aviso, ahora)) continue;
      // Dos instancias del API compartirían base y enviarían dos veces; el
      // guard de "ya se ejecutó este minuto" lo evita sin bloqueos.
      if (yaCorrioEsteMinuto(aviso, ahora)) continue;

      try {
        await this.ejecutar(aviso);
      } catch (error) {
        const detalle = error instanceof Error ? error.message : String(error);
        this.logger.error(`Aviso "${aviso.nombre}" falló: ${detalle}`);
      }
    }
  }

  private async ejecutar(aviso: AvisoProgramadoDocument): Promise<ResultadoAviso> {
    const usuarioIds = await this.destinatariosDelDisparador(aviso);

    // Un disparador con condición y sin nadie que la cumpla hoy no envía nada.
    // No es un fallo: es el caso normal la mayoría de los días.
    if (aviso.disparador !== 'difusion' && !usuarioIds.length) {
      await this.anotarEjecucion(aviso, 0);
      return { enviados: 0, destinatarios: 0, omitido: false };
    }

    const destinatarios = this.destinatariosDe(aviso.segmento, usuarioIds);
    const total = await this.pushService.contarDestinatarios(destinatarios);
    const resultado = await this.pushService.enviarAVarios(destinatarios, {
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo,
      ruta: aviso.ruta,
    });

    await this.anotarEjecucion(aviso, resultado.enviados);
    this.logger.log(`Aviso "${aviso.nombre}": ${resultado.enviados}/${total} entregados.`);

    return { enviados: resultado.enviados, destinatarios: total, omitido: resultado.omitido };
  }

  /**
   * A quién le toca según el disparador. Devuelve ids de usuario; una lista
   * vacía en `difusion` significa "a todo el segmento", no "a nadie".
   */
  private async destinatariosDelDisparador(aviso: AvisoProgramadoDocument): Promise<string[]> {
    if (aviso.disparador === 'difusion') return [];

    const db = this.avisoModel.db;
    const limite = new Date(Date.now() + aviso.diasAntelacion * MS_POR_DIA);

    if (aviso.disparador === 'pago_pendiente') {
      // Reservas que llevan pendientes más de `diasAntelacion` días: el cliente
      // dejó el pago a medias y aún puede retomarlo.
      const desde = new Date(Date.now() - aviso.diasAntelacion * MS_POR_DIA);
      const reservas = await db.collection('reservas')
        .find({ estado: ReservaEstado.PENDIENTE, createdAt: { $lte: desde } }, { projection: { usuarioId: 1 } })
        .toArray();
      return idsUnicos(reservas.map((r) => r['usuarioId']));
    }

    if (aviso.disparador === 'reserva_proxima') {
      const reservas = await db.collection('reservas')
        .find(
          { estado: ReservaEstado.CONFIRMADA, fechaInicio: { $gte: new Date(), $lte: limite } },
          { projection: { usuarioId: 1 } },
        )
        .toArray();
      return idsUnicos(reservas.map((r) => r['usuarioId']));
    }

    // membresia_por_vencer: el aviso va al staff del comercio, no al comercio,
    // porque las push llegan a personas y el comercio no tiene dispositivo.
    const comercios = await db.collection('comercios')
      .find(
        { estado: 'activo', suscripcionHasta: { $gte: new Date(), $lte: limite } },
        { projection: { _id: 1 } },
      )
      .toArray();

    if (!comercios.length) return [];

    const staff = await db.collection('usuarios')
      .find({ comercioId: { $in: comercios.map((c) => c._id) } }, { projection: { _id: 1 } })
      .toArray();

    return idsUnicos(staff.map((u) => u._id));
  }

  private destinatariosDe(segmento: SegmentoAviso, usuarioIds?: string[]): DestinatariosPush {
    if (usuarioIds?.length) return { usuarioIds };
    return { roles: ROLES_POR_SEGMENTO[segmento] };
  }

  private tocaHoy(aviso: AvisoProgramadoDocument, ahora: Date): boolean {
    if (!aviso.diasSemana?.length) return true;
    return aviso.diasSemana.includes(ahora.getDay());
  }

  private async anotarEjecucion(aviso: AvisoProgramadoDocument, enviados: number): Promise<void> {
    await this.avisoModel
      .updateOne({ _id: aviso._id }, { $set: { ultimaEjecucion: new Date(), ultimoEnviados: enviados } })
      .exec();
  }

  /** `HH:mm` de 24 horas. Una hora inválida dejaría el aviso mudo sin avisar. */
  private validarHora(hora?: string): void {
    if (hora === undefined) return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
      throw new DomainException('La hora debe tener el formato HH:mm (24 horas)', 400);
    }
  }
}

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

const idsUnicos = (valores: unknown[]): string[] =>
  [...new Set(valores.filter(Boolean).map((v) => String(v)))];

/** Evita el doble envío si el barrido corre dos veces dentro del mismo minuto. */
const yaCorrioEsteMinuto = (aviso: AvisoProgramadoDocument, ahora: Date): boolean => {
  if (!aviso.ultimaEjecucion) return false;
  return Math.abs(ahora.getTime() - aviso.ultimaEjecucion.getTime()) < 60_000;
};
