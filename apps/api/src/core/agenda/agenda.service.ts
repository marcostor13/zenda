import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Agenda, AgendaDocument, Bloqueo, BloqueoDocument, FranjaHoraria, Recurso, RecursoDocument,
} from './agenda.schema';
import {
  CALENDAR_CONNECTORS, CalendarConnector, ProveedorCalendario, TokensCalendario,
} from './calendar-connector.interface';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Hueco libre de una agenda, listo para ofrecerse como cita. */
export interface HuecoDisponible {
  inicio: Date;
  fin: Date;
}

const MINUTOS_POR_HORA = 60;
const DIAS_SINCRONIZACION = 60;

/**
 * Agenda de trabajadores y recursos (HU-050→052).
 *
 * Los huecos se calculan a partir de tres cosas: la jornada declarada, los
 * bloqueos (manuales o traídos del calendario externo) y el margen entre citas.
 *
 * **Política de conflicto: el bloqueo más restrictivo gana.** Si el calendario
 * externo dice "ocupado" y la jornada dice "disponible", manda el bloqueo. Al
 * revés se estaría vendiendo una franja en la que el profesional ya tiene algo.
 */
@Injectable()
export class AgendaService {
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    @InjectModel(Agenda.name) private readonly agendaModel: Model<AgendaDocument>,
    @InjectModel(Recurso.name) private readonly recursoModel: Model<RecursoDocument>,
    @InjectModel(Bloqueo.name) private readonly bloqueoModel: Model<BloqueoDocument>,
    @Inject(CALENDAR_CONNECTORS) private readonly connectors: CalendarConnector[],
  ) {}

  // ── Agendas y recursos ──

  listarAgendas(comercioId: string): Promise<AgendaDocument[]> {
    return this.agendaModel
      .find({ comercioId: this.aObjectId(comercioId) })
      .sort({ nombre: 1 })
      .exec();
  }

  crearAgenda(comercioId: string, datos: Partial<Agenda>): Promise<AgendaDocument> {
    return this.agendaModel.create({
      ...datos,
      comercioId: this.aObjectId(comercioId),
    });
  }

  async actualizarAgenda(
    agendaId: string,
    comercioId: string,
    datos: Partial<Agenda>,
  ): Promise<AgendaDocument> {
    const agenda = await this.agendaModel
      .findOneAndUpdate(
        { _id: this.aObjectId(agendaId), comercioId: this.aObjectId(comercioId) },
        // Los tokens nunca se tocan desde aquí: se fijan solo al conectar.
        { $set: { ...datos, tokens: undefined, proveedor: datos.proveedor } },
        { new: true },
      )
      .exec();

    if (!agenda) {
      throw new DomainException('Agenda no encontrada', 404);
    }
    return agenda;
  }

  listarRecursos(comercioId: string): Promise<RecursoDocument[]> {
    return this.recursoModel.find({ comercioId: this.aObjectId(comercioId) }).exec();
  }

  crearRecurso(comercioId: string, datos: Partial<Recurso>): Promise<RecursoDocument> {
    return this.recursoModel.create({ ...datos, comercioId: this.aObjectId(comercioId) });
  }

  // ── Bloqueos ──

  async bloquear(
    agendaId: string,
    comercioId: string,
    inicio: Date,
    fin: Date,
    motivo = '',
  ): Promise<BloqueoDocument> {
    await this.exigirAgendaPropia(agendaId, comercioId);

    if (fin <= inicio) {
      throw new DomainException('El bloqueo debe terminar después de empezar', 400);
    }

    return this.bloqueoModel.create({
      agendaId: this.aObjectId(agendaId),
      inicio, fin, motivo, origen: 'manual',
    });
  }

  async desbloquear(bloqueoId: string, comercioId: string): Promise<void> {
    const bloqueo = await this.bloqueoModel.findById(this.aObjectId(bloqueoId)).exec();
    if (!bloqueo) {
      throw new DomainException('Bloqueo no encontrado', 404);
    }
    await this.exigirAgendaPropia(bloqueo.agendaId.toString(), comercioId);

    if (bloqueo.origen === 'externo') {
      throw new DomainException(
        'Este bloqueo viene de tu calendario externo: bórralo allí y vuelve a sincronizar.',
        409,
      );
    }
    await bloqueo.deleteOne();
  }

  // ── Huecos disponibles ──

  /**
   * Huecos libres de una agenda en un día, con la duración pedida.
   *
   * Aplica el margen **después** de cada cita, no antes: un margen previo
   * bloquearía el primer hueco de la jornada sin motivo.
   */
  async huecosDe(agendaId: string, dia: Date, duracionMin: number): Promise<HuecoDisponible[]> {
    const agenda = await this.agendaModel.findById(this.aObjectId(agendaId)).exec();
    if (!agenda || !agenda.activa) return [];

    const franjas = agenda.franjas.filter((f) => f.diaSemana === dia.getDay());
    if (!franjas.length) return [];

    const inicioDia = new Date(dia); inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(dia); finDia.setHours(23, 59, 59, 999);

    const bloqueos = await this.bloqueoModel
      .find({ agendaId: agenda._id, inicio: { $lt: finDia }, fin: { $gt: inicioDia } })
      .sort({ inicio: 1 })
      .lean()
      .exec();

    const paso = duracionMin + agenda.margenMinutos;
    const huecos: HuecoDisponible[] = [];

    for (const franja of franjas) {
      let cursor = this.aFecha(dia, franja.desde);
      const cierre = this.aFecha(dia, franja.hasta);

      while (cursor.getTime() + duracionMin * MINUTOS_POR_HORA * 1000 <= cierre.getTime()) {
        const fin = new Date(cursor.getTime() + duracionMin * MINUTOS_POR_HORA * 1000);

        const chocaCon = bloqueos.find((b) => b.inicio < fin && b.fin > cursor);
        if (chocaCon) {
          // Salta al final del bloqueo en vez de avanzar de paso en paso.
          cursor = new Date(chocaCon.fin);
          continue;
        }

        huecos.push({ inicio: new Date(cursor), fin });
        cursor = new Date(cursor.getTime() + paso * MINUTOS_POR_HORA * 1000);
      }
    }

    return huecos;
  }

  // ── Sincronización con el calendario externo ──

  conector(proveedor: ProveedorCalendario): CalendarConnector {
    const encontrado = this.connectors.find((c) => c.proveedor === proveedor);
    if (!encontrado) {
      throw new DomainException(`Proveedor de calendario no soportado: ${proveedor}`, 400);
    }
    return encontrado;
  }

  /** Guarda los tokens tras el canje de OAuth y sincroniza por primera vez. */
  async conectarCalendario(
    agendaId: string,
    comercioId: string,
    proveedor: ProveedorCalendario,
    tokens: TokensCalendario,
  ): Promise<void> {
    await this.exigirAgendaPropia(agendaId, comercioId);

    await this.agendaModel
      .updateOne(
        { _id: this.aObjectId(agendaId) },
        { $set: { proveedor, tokens } },
      )
      .exec();

    await this.sincronizar(agendaId);
  }

  async desconectarCalendario(agendaId: string, comercioId: string): Promise<void> {
    await this.exigirAgendaPropia(agendaId, comercioId);

    await this.agendaModel
      .updateOne(
        { _id: this.aObjectId(agendaId) },
        { $unset: { proveedor: '', tokens: '', ultimaSincronizacion: '' } },
      )
      .exec();

    // Los bloqueos externos dejan de tener sentido sin la conexión.
    await this.bloqueoModel
      .deleteMany({ agendaId: this.aObjectId(agendaId), origen: 'externo' })
      .exec();
  }

  /**
   * Trae los eventos del proveedor y los refleja como bloqueos.
   *
   * Reconcilia por `externalEventId`: lo que ya no está en el proveedor se
   * borra aquí. Sin esa limpieza, una cita cancelada fuera seguiría bloqueando
   * la agenda para siempre.
   */
  async sincronizar(agendaId: string): Promise<{ importados: number; eliminados: number }> {
    const agenda = await this.agendaModel
      .findById(this.aObjectId(agendaId))
      .select('+tokens')
      .exec();

    if (!agenda?.proveedor || !agenda.tokens) {
      return { importados: 0, eliminados: 0 };
    }

    const conector = this.conector(agenda.proveedor);
    const tokens = await this.tokensVigentes(agenda, conector);

    const desde = new Date();
    const hasta = new Date(Date.now() + DIAS_SINCRONIZACION * 24 * 60 * 60 * 1000);

    let eventos;
    try {
      eventos = await conector.listarEventos(tokens, desde, hasta);
    } catch (error) {
      this.logger.warn(`Sincronización fallida de la agenda ${agendaId}: ${error}`);
      return { importados: 0, eliminados: 0 };
    }

    const ocupados = eventos.filter((e) => e.ocupado);
    const idsVigentes = ocupados.map((e) => e.externalEventId);

    for (const evento of ocupados) {
      await this.bloqueoModel
        .updateOne(
          { agendaId: agenda._id, externalEventId: evento.externalEventId },
          {
            $set: {
              inicio: evento.inicio,
              fin: evento.fin,
              motivo: evento.titulo,
              origen: 'externo',
            },
          },
          { upsert: true },
        )
        .exec();
    }

    const borrados = await this.bloqueoModel
      .deleteMany({
        agendaId: agenda._id,
        origen: 'externo',
        externalEventId: { $nin: idsVigentes },
      })
      .exec();

    agenda.ultimaSincronizacion = new Date();
    await agenda.save();

    return { importados: ocupados.length, eliminados: borrados.deletedCount ?? 0 };
  }

  /** Refresca el acceso si ha caducado, y persiste los tokens nuevos. */
  private async tokensVigentes(
    agenda: AgendaDocument,
    conector: CalendarConnector,
  ): Promise<TokensCalendario> {
    const tokens = agenda.tokens!;
    if (tokens.expiraEn.getTime() > Date.now() + 60_000) {
      return tokens as TokensCalendario;
    }

    if (!tokens.refreshToken) {
      throw new DomainException(
        'La conexión con el calendario ha caducado. Vuelve a conectarlo.',
        401,
      );
    }

    const renovados = await conector.refrescar(tokens.refreshToken);
    await this.agendaModel
      .updateOne({ _id: agenda._id }, { $set: { tokens: renovados } })
      .exec();

    return renovados;
  }

  private async exigirAgendaPropia(agendaId: string, comercioId: string): Promise<AgendaDocument> {
    const agenda = await this.agendaModel
      .findOne({ _id: this.aObjectId(agendaId), comercioId: this.aObjectId(comercioId) })
      .exec();

    if (!agenda) {
      throw new DomainException('Agenda no encontrada', 404);
    }
    return agenda;
  }

  /** `HH:mm` de una franja, aplicado a un día concreto. */
  private aFecha(dia: Date, hora: string): Date {
    const [h, m] = hora.split(':').map(Number);
    const fecha = new Date(dia);
    fecha.setHours(h || 0, m || 0, 0, 0);
    return fecha;
  }

  private aObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new DomainException('Identificador no válido', 400);
    }
    return new Types.ObjectId(id);
  }
}

export type { FranjaHoraria };
