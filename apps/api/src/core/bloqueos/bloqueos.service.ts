import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActualizarBloqueoDto, BloqueoDto, CitaAgendaDto, CrearBloqueoDto, ReservaEstado, claveDiaEnZona,
  etiquetaModalidadReserva,
} from 'shared';
import { BloqueoServicio, BloqueoServicioDocument } from './bloqueo-servicio.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { tramoDeLaReserva } from '../bookings/momento-reserva.util';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { CapacidadServicio, capacidadServicio } from '../catalog/disponibilidad';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Lo mínimo del servicio para saber cuántas plazas tiene. */
interface ServicioParaStock {
  _id: unknown;
  vertical: string;
}

/** Un cierre tal y como se va a guardar, para comprobarlo contra el inventario. */
interface TramoParcial {
  desde: Date;
  hasta: Date;
  cantidad?: number;
  espacioTipo?: string;
  /** Al editar, el propio bloqueo no cuenta como ocupación. */
  excluirId?: string;
}

/** Una reserva en estos estados sigue ocupando el hueco en la agenda. */
export const ESTADOS_VIVOS: ReservaEstado[] = [
  ReservaEstado.PENDIENTE,
  ReservaEstado.CONFIRMADA,
  ReservaEstado.AJUSTE_SOLICITADO,
  ReservaEstado.EN_CURSO,
  ReservaEstado.COMPLETADA,
  ReservaEstado.PAGO_RETENIDO,
  ReservaEstado.PAGO_LIBERADO,
  ReservaEstado.EN_DISPUTA,
];

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
    const servicio = await this.servicioDelComercio(comercioId, dto.servicioId);
    await this.validarStock(servicio, {
      desde, hasta, cantidad: dto.cantidad, espacioTipo: dto.espacioTipo,
    });

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

    const servicio = await this.servicioDelComercio(comercioId, String(bloqueo.servicioId));
    await this.validarStock(servicio, {
      desde, hasta, cantidad: bloqueo.cantidad, espacioTipo: bloqueo.espacioTipo, excluirId: bloqueoId,
    });

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
      .select({ codigo: 1, servicioId: 1, fechaInicio: 1, fechaFin: 1, estado: 1, perroSnapshot: 1, detalle: 1 })
      .populate('usuarioId', 'nombre')
      .sort({ fechaInicio: 1 })
      .lean()
      .exec() as unknown as Array<Record<string, unknown>>;

    return reservas.map((r) => {
      const { inicio, fin } = tramoDeLaReserva(r as unknown as Parameters<typeof tramoDeLaReserva>[0]);
      const usuario = r['usuarioId'] as { nombre?: string } | undefined;
      const perro = r['perroSnapshot'] as { nombre?: string } | undefined;
      const modalidad = etiquetaModalidadReserva(r['detalle'] as Record<string, unknown> | undefined);

      return {
        _id: String(r['_id']),
        codigo: (r['codigo'] as string) ?? '',
        servicioId: String(r['servicioId']),
        desde: inicio.toISOString(),
        hasta: fin.toISOString(),
        estado: (r['estado'] as string) ?? '',
        cliente: usuario?.nombre ?? 'Cliente',
        perro: perro?.nombre,
        ...(modalidad ? { modalidad } : {}),
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

  private async servicioDelComercio(comercioId: string, servicioId: string): Promise<ServicioParaStock> {
    const servicio = await this.servicioModel
      .findOne({ _id: new Types.ObjectId(servicioId), comercioId: new Types.ObjectId(comercioId) })
      .lean()
      .exec() as unknown as ServicioParaStock | null;
    if (!servicio) throw new DomainException('Servicio no encontrado', 404);
    return servicio;
  }

  /**
   * Un cierre parcial no puede cerrar más plazas de las que el servicio tiene
   * en la plataforma, ni más de las que quedan libres alguna de esas noches.
   *
   * Si no cuadra con el inventario publicado, la agenda dice una cosa y el
   * buscador otra: cerrar «8 de 5 suites» no significa nada, y cerrar 3 cuando
   * sólo quedan 2 deja al comercio creyendo que tiene algo vendido por fuera
   * que en realidad ya estaba reservado en Doogking.
   */
  private async validarStock(servicio: ServicioParaStock, tramo: TramoParcial): Promise<void> {
    if (!tramo.cantidad) return;

    const capacidad = this.capacidadParaElTramo(servicio, tramo);
    if (!capacidad) return;

    if (tramo.cantidad > capacidad.plazas) {
      throw new DomainException(
        `Este servicio tiene ${capacidad.plazas} plazas en Doogking: no puedes cerrar ${tramo.cantidad}. ` +
        'Si has ampliado tu capacidad, actualízala antes en «Mis servicios».', 400,
      );
    }

    const ocupadas = await this.ocupacionDelTramo(String(servicio._id), tramo, capacidad.porUnidad);
    this.exigirPlazasLibres(ocupadas, capacidad.plazas, tramo.cantidad);
  }

  private capacidadParaElTramo(servicio: ServicioParaStock, tramo: TramoParcial): CapacidadServicio | undefined {
    const datos = servicio as unknown as Record<string, unknown>;
    const general = capacidadServicio(servicio.vertical, datos);
    if (!general) return undefined;

    if (!tramo.espacioTipo) {
      if (general.porUnidad && general.unidades > 1) {
        throw new DomainException('Elige qué tipo de plaza cierras: cada tipo tiene su propio inventario.', 400);
      }
      return general;
    }

    const deLaUnidad = capacidadServicio(servicio.vertical, datos, tramo.espacioTipo);
    if (!deLaUnidad) throw new DomainException('Ese tipo de plaza ya no existe en el servicio.', 400);
    return deLaUnidad;
  }

  /** Plazas tomadas cada noche del tramo: reservas vivas más otros cierres parciales. */
  private async ocupacionDelTramo(
    servicioId: string, tramo: TramoParcial, porUnidad: boolean,
  ): Promise<Map<string, number>> {
    const noches = this.nochesDelTramo(tramo.desde, tramo.hasta);
    const ocupadas = new Map<string, number>(noches.map((n) => [n, 0]));
    const suma = (desde: Date, hasta: Date, unidades: number): void => {
      for (const noche of this.nochesDelTramo(desde, hasta)) {
        if (ocupadas.has(noche)) ocupadas.set(noche, (ocupadas.get(noche) ?? 0) + unidades);
      }
    };

    for (const r of await this.reservasDelTramo(servicioId, tramo, porUnidad)) {
      suma(r.fechaInicio, r.fechaFin ?? new Date(r.fechaInicio.getTime() + MS_POR_DIA), 1);
    }
    for (const b of await this.parcialesDelTramo(servicioId, tramo)) {
      suma(b.desde, b.hasta, b.cantidad ?? 0);
    }
    return ocupadas;
  }

  private reservasDelTramo(
    servicioId: string, tramo: TramoParcial, porUnidad: boolean,
  ): Promise<Array<{ fechaInicio: Date; fechaFin?: Date }>> {
    const filtro: Record<string, unknown> = {
      servicioId: new Types.ObjectId(servicioId),
      estado: { $in: ESTADOS_VIVOS },
      fechaInicio: { $lt: tramo.hasta },
      $or: [{ fechaFin: { $gt: tramo.desde } }, { fechaFin: { $exists: false } }],
    };
    // Mismo criterio que el calendario: por unidad sólo cuentan las de esa unidad.
    if (porUnidad && tramo.espacioTipo) filtro['detalle.espacioId'] = tramo.espacioTipo;

    return this.reservaModel.find(filtro).select({ fechaInicio: 1, fechaFin: 1 }).lean().exec() as
      unknown as Promise<Array<{ fechaInicio: Date; fechaFin?: Date }>>;
  }

  /** Cierres parciales que solapan el tramo; los totales no restan plazas sino que cierran. */
  private parcialesDelTramo(servicioId: string, tramo: TramoParcial): Promise<BloqueoServicio[]> {
    const filtro: Record<string, unknown> = {
      servicioId: new Types.ObjectId(servicioId),
      cantidad: { $gt: 0 },
      desde: { $lt: tramo.hasta },
      hasta: { $gt: tramo.desde },
    };
    if (tramo.excluirId) filtro['_id'] = { $ne: new Types.ObjectId(tramo.excluirId) };
    if (tramo.espacioTipo) {
      filtro['$or'] = [{ espacioTipo: tramo.espacioTipo }, { espacioTipo: { $in: [null, undefined] } }];
    }
    return this.bloqueoModel.find(filtro).select({ desde: 1, hasta: 1, cantidad: 1 }).lean().exec() as
      unknown as Promise<BloqueoServicio[]>;
  }

  private exigirPlazasLibres(ocupadas: Map<string, number>, plazas: number, cantidad: number): void {
    for (const [noche, usadas] of ocupadas) {
      const libres = Math.max(0, plazas - usadas);
      if (cantidad <= libres) continue;
      throw new DomainException(
        `El ${this.fechaLegible(noche)} sólo te quedan ${libres} de ${plazas} plazas libres ` +
        '(el resto ya está reservado en Doogking o bloqueado). Cierra como mucho esas.', 400,
      );
    }
  }

  /**
   * Noches `[desde, hasta)` por fecha de Madrid; un tramo de unas horas cuenta
   * como su día. Por zona y no por UTC: un cierre desde la medianoche de Madrid
   * cae a las 22:00 UTC del día anterior y el aviso nombraría el día que no es.
   */
  private nochesDelTramo(desde: Date, hasta: Date): string[] {
    const inicio = claveDiaEnZona(desde);
    const fin = claveDiaEnZona(hasta);
    const noches: string[] = [];
    for (let dia = new Date(`${inicio}T12:00:00Z`); dia.toISOString().slice(0, 10) < fin;
      dia = new Date(dia.getTime() + MS_POR_DIA)) {
      noches.push(dia.toISOString().slice(0, 10));
    }
    return noches.length ? noches : [inicio];
  }

  private fechaLegible(clave: string): string {
    return new Date(`${clave}T12:00:00Z`).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', timeZone: 'UTC',
    });
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
