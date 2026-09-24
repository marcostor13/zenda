import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { nanoid } from 'nanoid';
import {
  CrearSolicitudPresupuestoDto, EstadoRespuestaPresupuesto, EstadoSolicitudPresupuesto, ResponderPresupuestoDto,
  SolicitudPresupuestoComercioVista, SolicitudPresupuestoVista, VALIDEZ_PRESUPUESTO_DIAS, claveDiaEnZona,
  parsearFechaPlataforma,
} from 'shared';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PresupuestosRepository } from './presupuestos.repository';
import { RespuestaPresupuesto, SolicitudPresupuestoDocument } from './solicitud-presupuesto.schema';

interface ServicioResumen {
  _id: Types.ObjectId;
  comercioId: Types.ObjectId;
  vertical: string;
  titulo: string;
  imagenes?: string[];
  ratingPromedio?: number;
  estado: string;
  comercioActivo?: boolean;
}

const MS_POR_DIA = 86_400_000;

/**
 * Presupuestos a medida: el cliente describe una vez lo que necesita, lo
 * manda a una o varias empresas, cada una pone precio y el cliente acepta y
 * paga uno. El dinero entra por el mismo camino que cualquier reserva
 * (`bookings.crear` con `presupuestoId` → Stripe → webhook), así que la
 * comisión, el IVA y la liquidación salen igual que en el resto.
 */
@Injectable()
export class PresupuestosService {
  private readonly logger = new Logger(PresupuestosService.name);

  constructor(
    private readonly repo: PresupuestosRepository,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  async crear(usuarioId: string, dto: CrearSolicitudPresupuestoDto): Promise<SolicitudPresupuestoVista> {
    const servicios = await this.servicios([...new Set(dto.servicioIds)]);
    const validos = servicios.filter((s) => s.vertical === dto.vertical && s.estado === 'publicado' && s.comercioActivo);
    if (!validos.length) {
      throw new DomainException('Ninguna de esas empresas acepta solicitudes ahora mismo.', 409);
    }

    const solicitud = await this.repo.crear({
      codigo: `PRE-${nanoid(8).toUpperCase()}`,
      usuarioId: new Types.ObjectId(usuarioId),
      vertical: dto.vertical,
      detalle: dto.detalle,
      fechaServicio: parsearFechaPlataforma(dto.fechaServicio),
      comentario: dto.comentario,
      estado: EstadoSolicitudPresupuesto.ABIERTA,
      respuestas: validos.map((s) => ({
        servicioId: s._id,
        comercioId: s.comercioId,
        estado: EstadoRespuestaPresupuesto.PENDIENTE,
      })),
    });

    for (const servicio of validos) {
      void this.notifications.notificarSolicitudPresupuesto({
        comercioId: servicio.comercioId.toString(),
        codigo: solicitud.codigo,
        servicio: servicio.titulo,
        fechaServicio: solicitud.fechaServicio,
        resumen: resumenDe(solicitud.detalle),
        comentario: solicitud.comentario,
      });
    }
    return this.vistaCliente(solicitud, validos);
  }

  async misSolicitudes(usuarioId: string): Promise<SolicitudPresupuestoVista[]> {
    const solicitudes = await this.repo.deUsuario(usuarioId);
    const servicios = await this.servicios(solicitudes.flatMap((s) => s.respuestas.map((r) => r.servicioId.toString())));
    return solicitudes.map((s) => this.vistaCliente(s, servicios));
  }

  async deUsuario(id: string, usuarioId: string): Promise<SolicitudPresupuestoVista> {
    const solicitud = await this.propia(id, usuarioId);
    const servicios = await this.servicios(solicitud.respuestas.map((r) => r.servicioId.toString()));
    return this.vistaCliente(solicitud, servicios);
  }

  async cancelar(id: string, usuarioId: string): Promise<SolicitudPresupuestoVista> {
    const solicitud = await this.propia(id, usuarioId);
    if (solicitud.estado !== EstadoSolicitudPresupuesto.ABIERTA) {
      throw new DomainException('Esta solicitud ya no se puede cancelar.', 400);
    }
    solicitud.estado = EstadoSolicitudPresupuesto.CANCELADA;
    await solicitud.save();
    return this.deUsuario(id, usuarioId);
  }

  async bandejaComercio(comercioId: string): Promise<SolicitudPresupuestoComercioVista[]> {
    const solicitudes = await this.repo.deComercio(comercioId);
    const [servicios, clientes] = await Promise.all([
      this.servicios(solicitudes.flatMap((s) => s.respuestas.map((r) => r.servicioId.toString()))),
      this.nombresDeClientes(solicitudes.map((s) => s.usuarioId.toString())),
    ]);

    return solicitudes.flatMap((s) => s.respuestas
      .filter((r) => r.comercioId.toString() === comercioId)
      .map((r) => ({
        id: s._id.toString(),
        codigo: s.codigo,
        vertical: s.vertical,
        estadoSolicitud: s.estado,
        servicioId: r.servicioId.toString(),
        tituloServicio: servicios.find((x) => x._id.equals(r.servicioId))?.titulo ?? '',
        detalle: s.detalle,
        fechaServicio: s.fechaServicio.toISOString(),
        comentario: s.comentario,
        // Sólo el nombre: el contacto del cliente lo ve el comercio cuando hay reserva.
        clienteNombre: clientes.get(s.usuarioId.toString()) ?? 'Cliente',
        respuesta: vistaRespuesta(r),
        createdAt: (s.createdAt ?? new Date()).toISOString(),
      })));
  }

  async responder(
    id: string,
    comercioId: string,
    servicioId: string,
    dto: ResponderPresupuestoDto,
  ): Promise<SolicitudPresupuestoComercioVista[]> {
    const { solicitud, respuesta } = await this.respuestaDelComercio(id, comercioId, servicioId);
    respuesta.estado = EstadoRespuestaPresupuesto.RESPONDIDA;
    respuesta.importe = Math.round(dto.importe * 100) / 100;
    respuesta.condiciones = dto.condiciones;
    respuesta.validoHasta = new Date(Date.now() + (dto.validezDias ?? VALIDEZ_PRESUPUESTO_DIAS) * MS_POR_DIA);
    respuesta.respondidaAt = new Date();
    solicitud.markModified('respuestas');
    await solicitud.save();

    const [servicio] = await this.servicios([servicioId]);
    void this.notifications.notificarPresupuestoRecibido({
      usuarioId: solicitud.usuarioId.toString(),
      codigo: solicitud.codigo,
      empresa: servicio?.titulo ?? 'La empresa',
      importe: respuesta.importe,
      validoHasta: respuesta.validoHasta,
      condiciones: respuesta.condiciones,
    });
    return this.bandejaComercio(comercioId);
  }

  async rechazar(id: string, comercioId: string, servicioId: string, motivo?: string): Promise<SolicitudPresupuestoComercioVista[]> {
    const { solicitud, respuesta } = await this.respuestaDelComercio(id, comercioId, servicioId);
    respuesta.estado = EstadoRespuestaPresupuesto.RECHAZADA_POR_COMERCIO;
    respuesta.motivoRechazo = motivo;
    respuesta.respondidaAt = new Date();
    solicitud.markModified('respuestas');
    await solicitud.save();
    return this.bandejaComercio(comercioId);
  }

  /**
   * Importe con el que se crea la reserva de un presupuesto aceptado. Lo llama
   * `BookingsService.crear`: comprueba que el presupuesto sea del cliente, que
   * esté respondido para ese servicio y que no haya caducado.
   */
  async importeParaReserva(presupuestoId: string, usuarioId: string, servicioId: string): Promise<number> {
    const solicitud = await this.propia(presupuestoId, usuarioId);
    if (solicitud.estado !== EstadoSolicitudPresupuesto.ABIERTA && solicitud.estado !== EstadoSolicitudPresupuesto.ACEPTADA) {
      throw new DomainException('Este presupuesto ya no está disponible.', 409);
    }
    const respuesta = solicitud.respuestas.find((r) => r.servicioId.toString() === servicioId);
    if (!respuesta || !respuesta.importe
      || ![EstadoRespuestaPresupuesto.RESPONDIDA, EstadoRespuestaPresupuesto.ACEPTADA].includes(respuesta.estado)) {
      throw new DomainException('Esta empresa todavía no ha respondido al presupuesto.', 409);
    }
    if (respuesta.validoHasta && respuesta.validoHasta.getTime() < Date.now()) {
      throw new DomainException('Este presupuesto ha caducado. Pide uno nuevo a la empresa.', 409);
    }

    respuesta.estado = EstadoRespuestaPresupuesto.ACEPTADA;
    solicitud.estado = EstadoSolicitudPresupuesto.ACEPTADA;
    solicitud.markModified('respuestas');
    await solicitud.save();
    return respuesta.importe;
  }

  /** Tras cobrarse la reserva: la solicitud queda convertida y el resto de ofertas, descartadas. */
  async marcarConvertida(presupuestoId: string, servicioId: string, reservaId: string): Promise<void> {
    const solicitud = await this.repo.porId(presupuestoId);
    if (!solicitud || solicitud.estado === EstadoSolicitudPresupuesto.CONVERTIDA) return;

    for (const respuesta of solicitud.respuestas) {
      respuesta.estado = respuesta.servicioId.toString() === servicioId
        ? EstadoRespuestaPresupuesto.ACEPTADA
        : EstadoRespuestaPresupuesto.DESCARTADA;
    }
    solicitud.estado = EstadoSolicitudPresupuesto.CONVERTIDA;
    solicitud.reservaId = new Types.ObjectId(reservaId);
    solicitud.markModified('respuestas');
    await solicitud.save();
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async caducarVencidas(): Promise<number> {
    const hoy = new Date(`${claveDiaEnZona(new Date())}T00:00:00Z`);
    const vencidas = await this.repo.caducadas(hoy);
    for (const solicitud of vencidas) {
      solicitud.estado = EstadoSolicitudPresupuesto.CADUCADA;
      await solicitud.save();
    }
    if (vencidas.length) this.logger.log(`${vencidas.length} solicitud(es) de presupuesto caducada(s).`);
    return vencidas.length;
  }

  private async propia(id: string, usuarioId: string): Promise<SolicitudPresupuestoDocument> {
    const solicitud = await this.repo.porId(id);
    if (!solicitud) throw new DomainException('Solicitud de presupuesto no encontrada', 404);
    if (solicitud.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso sobre esta solicitud', 403);
    }
    return solicitud;
  }

  private async respuestaDelComercio(
    id: string,
    comercioId: string,
    servicioId: string,
  ): Promise<{ solicitud: SolicitudPresupuestoDocument; respuesta: RespuestaPresupuesto }> {
    const solicitud = await this.repo.porId(id);
    const respuesta = solicitud?.respuestas.find(
      (r) => r.comercioId.toString() === comercioId && r.servicioId.toString() === servicioId,
    );
    if (!solicitud || !respuesta) throw new DomainException('Solicitud de presupuesto no encontrada', 404);
    if (solicitud.estado !== EstadoSolicitudPresupuesto.ABIERTA) {
      throw new DomainException('El cliente ya no espera respuesta a esta solicitud.', 409);
    }
    return { solicitud, respuesta };
  }

  private async servicios(ids: string[]): Promise<ServicioResumen[]> {
    const validos = [...new Set(ids)].filter((id) => Types.ObjectId.isValid(id));
    if (!validos.length) return [];
    return this.servicioModel
      .find({ _id: { $in: validos } })
      .select('comercioId vertical titulo imagenes ratingPromedio estado comercioActivo')
      .lean()
      .exec() as unknown as Promise<ServicioResumen[]>;
  }

  private async nombresDeClientes(ids: string[]): Promise<Map<string, string>> {
    const usuarios = await this.usuarioModel
      .find({ _id: { $in: [...new Set(ids)] } })
      .select('nombre')
      .lean()
      .exec() as unknown as Array<{ _id: Types.ObjectId; nombre: string }>;
    return new Map(usuarios.map((u) => [u._id.toString(), u.nombre]));
  }

  private vistaCliente(s: SolicitudPresupuestoDocument, servicios: ServicioResumen[]): SolicitudPresupuestoVista {
    return {
      id: s._id.toString(),
      codigo: s.codigo,
      vertical: s.vertical,
      estado: s.estado,
      detalle: s.detalle,
      fechaServicio: s.fechaServicio.toISOString(),
      comentario: s.comentario,
      respuestas: s.respuestas.map((r) => {
        const servicio = servicios.find((x) => x._id.equals(r.servicioId));
        return {
          ...vistaRespuesta(r),
          titulo: servicio?.titulo ?? '',
          imagen: servicio?.imagenes?.[0],
          rating: servicio?.ratingPromedio ?? 0,
        };
      }),
      reservaId: s.reservaId?.toString(),
      createdAt: (s.createdAt ?? new Date()).toISOString(),
    };
  }
}

function vistaRespuesta(r: RespuestaPresupuesto): SolicitudPresupuestoComercioVista['respuesta'] {
  return {
    servicioId: r.servicioId.toString(),
    comercioId: r.comercioId.toString(),
    estado: r.estado,
    importe: r.importe,
    condiciones: r.condiciones,
    validoHasta: r.validoHasta?.toISOString(),
    motivoRechazo: r.motivoRechazo,
    respondidaAt: r.respondidaAt?.toISOString(),
  };
}

/** Filas legibles que manda el cliente junto a su solicitud (`detalle.resumen`), si las hay. */
function resumenDe(detalle: Record<string, unknown>): Array<[string, string]> {
  const resumen = detalle['resumen'];
  if (!Array.isArray(resumen)) return [];
  return resumen
    .filter((fila): fila is [unknown, unknown] => Array.isArray(fila) && fila.length === 2)
    .map(([etiqueta, valor]) => [String(etiqueta).slice(0, 80), String(valor).slice(0, 300)]);
}
