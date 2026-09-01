import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActualizarBloqueoDto, BloqueoDto, CitaAgendaDto, CrearBloqueoDto, ReservaEstado } from 'shared';
import { BloqueoServicio, BloqueoServicioDocument } from './bloqueo-servicio.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Una reserva en estos estados sigue ocupando el hueco en la agenda. */
const ESTADOS_VIVOS: ReservaEstado[] = [
  ReservaEstado.PENDIENTE,
  ReservaEstado.CONFIRMADA,
  ReservaEstado.AJUSTE_SOLICITADO,
  ReservaEstado.EN_CURSO,
  ReservaEstado.COMPLETADA,
  ReservaEstado.PAGO_RETENIDO,
  ReservaEstado.PAGO_LIBERADO,
  ReservaEstado.EN_DISPUTA,
];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Agenda de los servicios del comercio: lo reservado por Doogking y lo que el
 * propio negocio cierra por su cuenta.
 *
 * Un comercio no vende sólo aquí. Si alquila dos suites por teléfono o se va de
 * vacaciones y esas plazas siguen ofreciéndose, acaba con dos reservas para el
 * mismo sitio. Los bloqueos son lo que permite tener un único calendario con lo
 * de dentro y lo de fuera de la plataforma.
 */
@Injectable()
export class BloqueosService {
  constructor(
    @InjectModel(BloqueoServicio.name) private readonly bloqueoModel: Model<BloqueoServicioDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  /** Tramos cerrados de un comercio, opcionalmente acotados a un servicio y un rango. */
  async listar(
    comercioId: string,
    filtros: { servicioId?: string; desde?: Date; hasta?: Date } = {},
  ): Promise<BloqueoDto[]> {
    const filtro: Record<string, unknown> = { comercioId: new Types.ObjectId(comercioId) };
    if (filtros.servicioId) filtro['servicioId'] = new Types.ObjectId(filtros.servicioId);
    if (filtros.desde && filtros.hasta) {
      // Solapamiento, no contención: un bloqueo de agosto entero tiene que salir
      // al mirar la semana del 15, aunque ni empiece ni acabe dentro de ella.
      filtro['desde'] = { $lt: filtros.hasta };
      filtro['hasta'] = { $gt: filtros.desde };
    }

    const bloqueos = await this.bloqueoModel.find(filtro).sort({ desde: 1 }).lean().exec();
    return bloqueos.map((b) => this.aDto(b as unknown as BloqueoServicioDocument));
  }

  /** Cierra un tramo. Valida que el servicio sea del comercio que lo pide. */
  async crear(comercioId: string, dto: CrearBloqueoDto, usuarioId?: string): Promise<BloqueoDto> {
    const desde = new Date(dto.desde);
    const hasta = new Date(dto.hasta);

    if (!(hasta.getTime() > desde.getTime())) {
      throw new DomainException('El fin del bloqueo tiene que ser posterior a su inicio', 400);
    }

    // Multi-tenant: sin esta comprobación un comercio podría cerrarle la agenda
    // a otro pasando su `servicioId`.
    const servicio = await this.servicioModel
      .findOne({ _id: new Types.ObjectId(dto.servicioId), comercioId: new Types.ObjectId(comercioId) })
      .select({ _id: 1 })
      .lean()
      .exec();
    if (!servicio) throw new DomainException('Servicio no encontrado', 404);

    const creado = await this.bloqueoModel.create({
      comercioId: new Types.ObjectId(comercioId),
      servicioId: new Types.ObjectId(dto.servicioId),
      desde,
      hasta,
      motivo: dto.motivo.trim(),
      cantidad: dto.cantidad,
      espacioTipo: dto.espacioTipo,
      creadoPor: usuarioId ? new Types.ObjectId(usuarioId) : undefined,
    });

    return this.aDto(creado);
  }

  /**
   * Edita un tramo ya cerrado.
   *
   * Se edita en vez de borrar y volver a crear porque el caso real es corregir
   * lo que ya estaba —la salida se retrasa un día, el motivo estaba mal escrito,
   * eran tres suites y no dos— y borrar deja el hueco abierto en el buscador
   * durante el rato que tarde el comercio en volver a cerrarlo.
   */
  async actualizar(comercioId: string, bloqueoId: string, dto: ActualizarBloqueoDto): Promise<BloqueoDto> {
    const bloqueo = await this.bloqueoModel.findOne({
      _id: new Types.ObjectId(bloqueoId),
      comercioId: new Types.ObjectId(comercioId),
    }).exec();
    if (!bloqueo) throw new DomainException('Bloqueo no encontrado', 404);

    const desde = dto.desde ? new Date(dto.desde) : bloqueo.desde;
    const hasta = dto.hasta ? new Date(dto.hasta) : bloqueo.hasta;
    if (!(hasta.getTime() > desde.getTime())) {
      throw new DomainException('El fin del bloqueo tiene que ser posterior a su inicio', 400);
    }

    bloqueo.desde = desde;
    bloqueo.hasta = hasta;
    if (dto.motivo !== undefined) bloqueo.motivo = dto.motivo.trim();
    if (dto.espacioTipo !== undefined) bloqueo.espacioTipo = dto.espacioTipo || undefined;
    // `null` es una orden explícita ("ciérralo entero"); ausente no toca nada.
    if (dto.cantidad !== undefined) bloqueo.cantidad = dto.cantidad ?? undefined;

    await bloqueo.save();
    return this.aDto(bloqueo);
  }

  async eliminar(comercioId: string, bloqueoId: string): Promise<void> {
    const borrado = await this.bloqueoModel.findOneAndDelete({
      _id: new Types.ObjectId(bloqueoId),
      comercioId: new Types.ObjectId(comercioId),
    }).exec();

    if (!borrado) throw new DomainException('Bloqueo no encontrado', 404);
  }

  /** Reservas vivas del comercio en un rango, para pintarlas junto a los bloqueos. */
  async listarCitas(comercioId: string, desde: Date, hasta: Date, servicioId?: string): Promise<CitaAgendaDto[]> {
    const filtro: Record<string, unknown> = {
      comercioId: new Types.ObjectId(comercioId),
      estado: { $in: ESTADOS_VIVOS },
      fechaInicio: { $lt: hasta },
      $or: [{ fechaFin: { $gt: desde } }, { fechaFin: { $exists: false } }],
    };
    if (servicioId) filtro['servicioId'] = new Types.ObjectId(servicioId);

    const reservas = await this.reservaModel
      .find(filtro)
      .select({ codigo: 1, servicioId: 1, fechaInicio: 1, fechaFin: 1, estado: 1, perroSnapshot: 1 })
      .populate('usuarioId', 'nombre')
      .sort({ fechaInicio: 1 })
      .lean()
      .exec() as unknown as Array<Record<string, unknown>>;

    return reservas.map((r) => {
      const inicio = r['fechaInicio'] as Date;
      // Una cita sin fin declarado ocupa su día: es lo que pinta la agenda.
      const fin = (r['fechaFin'] as Date | undefined) ?? new Date(inicio.getTime() + MS_POR_DIA);
      const usuario = r['usuarioId'] as { nombre?: string } | undefined;
      const perro = r['perroSnapshot'] as { nombre?: string } | undefined;

      return {
        _id: String(r['_id']),
        codigo: (r['codigo'] as string) ?? '',
        servicioId: String(r['servicioId']),
        desde: inicio.toISOString(),
        hasta: fin.toISOString(),
        estado: (r['estado'] as string) ?? '',
        cliente: usuario?.nombre ?? 'Cliente',
        perro: perro?.nombre,
      };
    });
  }

  /**
   * El cierre **total** que solapa el tramo pedido, si lo hay.
   *
   * Los parciales no se miran aquí: ésos restan inventario y los resuelve el
   * calendario de ocupación. Éste es el corte seco de "ese día no abro".
   */
  async cierreQueSolapa(servicioId: string, desde: Date, hasta?: Date): Promise<BloqueoServicio | null> {
    const fin = hasta ?? new Date(desde.getTime() + 1);

    return this.bloqueoModel
      .findOne({
        servicioId: new Types.ObjectId(servicioId),
        cantidad: { $in: [null, undefined] },
        desde: { $lt: fin },
        hasta: { $gt: desde },
      })
      .lean()
      .exec() as Promise<BloqueoServicio | null>;
  }

  private aDto(b: BloqueoServicioDocument): BloqueoDto {
    return {
      _id: String(b._id),
      servicioId: String(b.servicioId),
      desde: b.desde.toISOString(),
      hasta: b.hasta.toISOString(),
      motivo: b.motivo,
      cantidad: b.cantidad,
      espacioTipo: b.espacioTipo,
    };
  }
}
