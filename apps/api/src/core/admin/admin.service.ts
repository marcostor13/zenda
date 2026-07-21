import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { UsersRepository } from '../users/users.repository';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { Comercio } from '../comercios/comercio.schema';
import { Perro, PerroDocument } from '../perros/perro.schema';
import { ActualizarComisionDto, ReporteFinancieroDto, ReporteVerticalDto, PagoEstado, ReservaEstado, Rol, VerticalKey } from 'shared';
import { ComisionConfigDocument } from '../comision-configs/comision-config.schema';
import { ComercioDocument, EstadoComercio, PlanComercio } from '../comercios/comercio.schema';

interface PagoLean {
  reservaId: Types.ObjectId;
  montoTotal: number;
  comisionPlataforma: number;
  stripeFee: number;
  montoLiquidacion: number;
}

interface ReservaLean {
  _id: Types.ObjectId;
  codigo: string;
  vertical: string;
  montoTotal: number;
  estado: string;
  createdAt: Date;
}

interface ReservaEnriquecidaLean extends ReservaLean {
  fechaInicio?: Date;
  usuarioId?: { nombre?: string };
  comercioId?: { nombreComercial?: string };
}

export interface FiltrosReporte {
  fechaDesde: Date;
  fechaHasta: Date;
  vertical?: string;
  comercioId?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly comisionConfigRepo: ComisionConfigRepository,
    private readonly comerciosRepo: ComerciosRepository,
    private readonly usersRepo: UsersRepository,
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
  ) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  async obtenerDashboard(): Promise<{
    kpis: {
      totalReservas: number;
      gmvMes: number;
      ingresosMes: number;
      comerciosPendientesCount: number;
      totalUsuarios: number;
      verificacionesPendientes: number;
      nuevosComerciosMes: number;
      mascotasRegistradas: number;
      tasaCancelacionMes: number;
      pagosRetenidosMonto: number;
      pagosRetenidosCount: number;
      incidenciasAbiertas: number;
    };
    comerciosPendientes: Array<{
      id: string;
      nombre: string;
      nif: string;
      vertical: string;
      inicial: string;
    }>;
    ultimasReservas: Array<{
      id: string;
      codigo: string;
      vertical: string;
      montoTotal: number;
      estado: string;
      createdAt: Date;
      fechaServicio: Date | null;
      cliente: string;
      comercio: string;
    }>;
    comisiones: ComisionConfigDocument[];
  }> {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    const [
      totalReservas,
      totalUsuarios,
      comerciosPendientesList,
      ultimasReservas,
      pagosDelMes,
      comisiones,
      verificacionesPendientes,
      nuevosComerciosMes,
      mascotasRegistradas,
      reservasDelMes,
      canceladasDelMes,
      pagosRetenidosAgg,
      incidenciasAbiertas,
    ] = await Promise.all([
      this.reservaModel.countDocuments().exec(),
      this.usersRepo.contarTodos(),
      this.comerciosRepo.listar({ estado: 'pendiente' }),
      this.reservaModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('codigo vertical montoTotal estado createdAt fechaInicio')
        .populate('usuarioId', 'nombre')
        .populate('comercioId', 'nombreComercial')
        .lean()
        .exec() as unknown as Promise<ReservaEnriquecidaLean[]>,
      this.pagoModel.aggregate<{ gmv: number; ingresos: number }>([
        { $match: { estado: PagoEstado.APROBADO, createdAt: { $gte: inicioMes } } },
        { $group: { _id: null, gmv: { $sum: '$montoTotal' }, ingresos: { $sum: '$comisionPlataforma' } } },
      ]).exec(),
      this.comisionConfigRepo.listarTodas(),
      this.comercioModel.countDocuments({ 'verificacion.estado': 'pendiente' }).exec(),
      this.comercioModel.countDocuments({ createdAt: { $gte: inicioMes } }).exec(),
      this.perroModel.countDocuments().exec(),
      this.reservaModel.countDocuments({ createdAt: { $gte: inicioMes } }).exec(),
      this.reservaModel.countDocuments({ createdAt: { $gte: inicioMes }, estado: ReservaEstado.CANCELADA }).exec(),
      this.reservaModel.aggregate<{ monto: number; count: number }>([
        { $match: { estado: ReservaEstado.PAGO_RETENIDO } },
        { $group: { _id: null, monto: { $sum: '$montoTotal' }, count: { $sum: 1 } } },
      ]).exec(),
      this.reservaModel.countDocuments({ estado: ReservaEstado.EN_DISPUTA }).exec(),
    ]);

    const gmvMes     = Math.round((pagosDelMes[0]?.gmv     ?? 0) * 100) / 100;
    const ingresosMes = Math.round((pagosDelMes[0]?.ingresos ?? 0) * 100) / 100;
    const tasaCancelacionMes = reservasDelMes > 0
      ? Math.round((canceladasDelMes / reservasDelMes) * 1000) / 10
      : 0;
    const pagosRetenidosMonto = Math.round((pagosRetenidosAgg[0]?.monto ?? 0) * 100) / 100;
    const pagosRetenidosCount = pagosRetenidosAgg[0]?.count ?? 0;

    return {
      kpis: {
        totalReservas,
        gmvMes,
        ingresosMes,
        comerciosPendientesCount: comerciosPendientesList.length,
        totalUsuarios,
        verificacionesPendientes,
        nuevosComerciosMes,
        mascotasRegistradas,
        tasaCancelacionMes,
        pagosRetenidosMonto,
        pagosRetenidosCount,
        incidenciasAbiertas,
      },
      comerciosPendientes: comerciosPendientesList.map((c) => ({
        id: String(c._id),
        nombre: c.nombreComercial,
        nif: c.vatNumber ?? '—',
        vertical: c.verticales[0] ?? '',
        inicial: (c.nombreComercial[0] ?? 'C').toUpperCase(),
      })),
      ultimasReservas: ultimasReservas.map((r) => ({
        id: String(r._id),
        codigo: r.codigo,
        vertical: r.vertical,
        montoTotal: r.montoTotal,
        estado: r.estado,
        createdAt: r.createdAt,
        fechaServicio: r.fechaInicio ?? null,
        cliente: r.usuarioId?.nombre ?? 'Cliente',
        comercio: r.comercioId?.nombreComercial ?? 'Comercio',
      })),
      comisiones,
    };
  }

  // ── Comisiones ───────────────────────────────────────────────────────────────

  async listarComisiones(): Promise<ComisionConfigDocument[]> {
    return this.comisionConfigRepo.listarTodas();
  }

  async actualizarComision(
    dto: ActualizarComisionDto,
    adminId: string,
  ): Promise<ComisionConfigDocument> {
    return this.comisionConfigRepo.upsert(
      dto.vertical,
      {
        comisionPct: dto.comisionPct,
        stripePct: dto.stripePct,
        stripeFijoEur: dto.stripeFijoEur,
        activo: dto.activo,
      },
      adminId,
    );
  }

  // ── Comercios CRUD ───────────────────────────────────────────────────────────

  async listarComercios(
    page = 1,
    limite = 20,
    estado?: string,
    buscar?: string,
  ): Promise<{ items: ComercioDocument[]; total: number }> {
    return this.comerciosRepo.listarPaginado(
      { estado: estado as EstadoComercio | undefined, buscar },
      page,
      limite,
    );
  }

  async crearComercio(datos: {
    razonSocial: string;
    vatNumber: string;
    nombreComercial: string;
    logoUrl?: string;
    verticales?: VerticalKey[];
    plan?: PlanComercio;
    estado?: EstadoComercio;
  }): Promise<ComercioDocument> {
    return this.comerciosRepo.crear({ ...datos, estado: datos.estado ?? 'activo' });
  }

  async actualizarComercio(
    id: string,
    datos: {
      razonSocial?: string;
      nombreComercial?: string;
      logoUrl?: string;
      verticales?: VerticalKey[];
      plan?: PlanComercio;
      estado?: EstadoComercio;
      comisionPctOverride?: number;
    },
  ): Promise<ComercioDocument> {
    const actualizado = await this.comerciosRepo.actualizar(id, datos);
    if (!actualizado) throw new NotFoundException('Comercio no encontrado');
    return actualizado;
  }

  async eliminarComercio(id: string): Promise<void> {
    await this.comerciosRepo.eliminar(id);
  }

  /** El admin verifica o rechaza la documentación del comercio. */
  async cambiarVerificacionComercio(
    id: string,
    estado: 'verificado' | 'rechazado' | 'pendiente',
    motivo?: string,
  ): Promise<ComercioDocument> {
    const comercio = await this.comerciosRepo.findById(id);
    if (!comercio) throw new NotFoundException('Comercio no encontrado');

    const documentos = (comercio.verificacion?.documentos ?? []).map((d) => ({
      ...d,
      estado: estado === 'verificado' ? 'verificado' : estado === 'rechazado' ? 'rechazado' : d.estado,
    }));

    const actualizado = await this.comerciosRepo.actualizar(id, {
      verificacion: {
        ...comercio.verificacion,
        estado,
        motivoRechazo: estado === 'rechazado' ? motivo : undefined,
        documentos,
      },
    } as Parameters<ComerciosRepository['actualizar']>[1]);
    if (!actualizado) throw new NotFoundException('Comercio no encontrado');
    return actualizado;
  }

  // ── Usuarios CRUD ────────────────────────────────────────────────────────────

  async listarUsuarios(
    page = 1,
    limite = 20,
    rol?: string,
    buscar?: string,
  ): Promise<{ items: UsuarioDocument[]; total: number }> {
    const skip = (page - 1) * limite;
    const filtro: Record<string, unknown> = {};
    if (rol) filtro['rol'] = rol;
    if (buscar) {
      const escaped = buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filtro['$or'] = [{ nombre: regex }, { email: regex }];
    }
    const [items, total] = await Promise.all([
      this.usuarioModel.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limite).lean().exec() as unknown as UsuarioDocument[],
      this.usuarioModel.countDocuments(filtro).exec(),
    ]);
    return { items, total };
  }

  async crearUsuario(datos: {
    nombre: string;
    email: string;
    password: string;
    telefono?: string;
    rol?: Rol;
    comercioId?: string;
  }): Promise<UsuarioDocument> {
    const rol = datos.rol ?? Rol.CLIENTE;
    // Un usuario de comercio sin comercioId no podría gestionar listados/reservas.
    if ((rol === Rol.COMERCIO_ADMIN || rol === Rol.COMERCIO_STAFF) && !datos.comercioId) {
      throw new BadRequestException('Un usuario de comercio requiere un comercioId asociado.');
    }
    const passwordHash = await bcrypt.hash(datos.password, 10);
    return this.usersRepo.crear({
      nombre: datos.nombre,
      email: datos.email,
      passwordHash,
      telefono: datos.telefono,
      rol,
      comercioId: datos.comercioId,
    });
  }

  async actualizarUsuario(
    id: string,
    datos: { nombre?: string; email?: string; telefono?: string; rol?: Rol; verificado?: boolean; comercioId?: string },
  ): Promise<UsuarioDocument> {
    const actualizado = await this.usersRepo.actualizarAdmin(id, datos);
    if (!actualizado) throw new NotFoundException('Usuario no encontrado');
    return actualizado;
  }

  async eliminarUsuario(id: string): Promise<void> {
    await this.usersRepo.eliminar(id);
  }

  // ── Listados admin ───────────────────────────────────────────────────────────

  async listarReservas(
    page = 1,
    limite = 20,
    filtros: { estado?: string; comercioId?: string; buscar?: string; fechaDesde?: string; fechaHasta?: string } = {},
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const skip = (page - 1) * limite;
    const filtro: Record<string, unknown> = {};
    if (filtros.estado) filtro['estado'] = filtros.estado;
    if (filtros.comercioId) filtro['comercioId'] = filtros.comercioId;
    if (filtros.buscar) {
      const escaped = filtros.buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filtro['codigo'] = new RegExp(escaped, 'i');
    }
    if (filtros.fechaDesde || filtros.fechaHasta) {
      const rango: Record<string, Date> = {};
      if (filtros.fechaDesde) rango['$gte'] = new Date(filtros.fechaDesde);
      if (filtros.fechaHasta) rango['$lte'] = new Date(filtros.fechaHasta);
      filtro['fechaInicio'] = rango;
    }

    const [items, total] = await Promise.all([
      this.reservaModel
        .find(filtro)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limite)
        .populate('usuarioId', 'nombre email')
        .populate('comercioId', 'nombreComercial')
        .lean()
        .exec() as unknown as ReservaEnriquecidaLean[],
      this.reservaModel.countDocuments(filtro).exec(),
    ]);

    const enriquecidas = items.map((r) => ({
      ...r,
      id: String(r._id),
      cliente: r.usuarioId?.nombre ?? 'Cliente',
      comercio: r.comercioId?.nombreComercial ?? 'Comercio',
      comisionMonto: (r as unknown as { comisionMonto?: number }).comisionMonto ?? 0,
    }));

    return { items: enriquecidas, total };
  }

  // Estados que un admin puede fijar manualmente desde el centro de reservas.
  private static readonly ESTADOS_ADMIN = [
    ReservaEstado.PAGO_RETENIDO,
    ReservaEstado.PAGO_LIBERADO,
    ReservaEstado.EN_DISPUTA,
    ReservaEstado.REEMBOLSADA,
    ReservaEstado.EN_CURSO,
    ReservaEstado.CANCELADA,
    ReservaEstado.COMPLETADA,
  ];

  async cambiarEstadoReserva(
    id: string,
    estado: string,
    adminId: string,
    motivo?: string,
  ): Promise<ReservaDocument> {
    if (!AdminService.ESTADOS_ADMIN.includes(estado as ReservaEstado)) {
      throw new BadRequestException(`Estado no permitido para operación de admin: ${estado}`);
    }
    const reserva = await this.reservaModel.findByIdAndUpdate(
      id,
      {
        estado,
        $push: { historialEstados: { estado, motivo, por: `admin:${adminId}`, at: new Date() } },
      },
      { new: true },
    ).exec();
    if (!reserva) throw new NotFoundException('Reserva no encontrada');
    return reserva;
  }

  // ── Analítica (Fase 4) ───────────────────────────────────────────────────────

  /**
   * Analítica global para el panel admin: distribución por vertical, distribución
   * geográfica (mapa de calor por ciudad), Top 5 comercios por facturación y
   * embudo de conversión (registrados → con reserva → pagaron).
   */
  async obtenerAnalitica(): Promise<{
    porVertical: Array<{ vertical: string; reservas: number; porcentaje: number }>;
    porCiudad: Array<{ ciudad: string; reservas: number }>;
    topComercios: Array<{ comercio: string; reservas: number; facturacion: number }>;
    embudo: { registrados: number; conReserva: number; pagaron: number };
  }> {
    const [porVerticalRaw, porCiudadRaw, topComerciosRaw, registrados, usuariosConReserva, pagaron] = await Promise.all([
      this.reservaModel.aggregate<{ _id: string; reservas: number }>([
        { $group: { _id: '$vertical', reservas: { $sum: 1 } } },
        { $sort: { reservas: -1 } },
      ]).exec(),
      this.reservaModel.aggregate<{ _id: string; reservas: number }>([
        { $lookup: { from: 'servicios', localField: 'servicioId', foreignField: '_id', as: 'servicio' } },
        { $unwind: '$servicio' },
        { $group: { _id: '$servicio.ubicacion.ciudad', reservas: { $sum: 1 } } },
        { $sort: { reservas: -1 } },
        { $limit: 15 },
      ]).exec(),
      this.pagoModel.aggregate<{ nombre: string; reservas: number; facturacion: number }>([
        { $match: { estado: PagoEstado.APROBADO } },
        { $lookup: { from: 'reservas', localField: 'reservaId', foreignField: '_id', as: 'reserva' } },
        { $unwind: '$reserva' },
        { $group: { _id: '$reserva.comercioId', facturacion: { $sum: '$montoTotal' }, reservas: { $sum: 1 } } },
        { $sort: { facturacion: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'comercios', localField: '_id', foreignField: '_id', as: 'comercio' } },
        { $unwind: '$comercio' },
        { $project: { _id: 0, nombre: '$comercio.nombreComercial', reservas: 1, facturacion: 1 } },
      ]).exec(),
      this.usersRepo.contarTodos(),
      this.reservaModel.distinct('usuarioId').exec().then((ids) => ids.length),
      this.pagoModel.countDocuments({ estado: PagoEstado.APROBADO }).exec(),
    ]);

    const totalReservas = porVerticalRaw.reduce((s, v) => s + v.reservas, 0) || 1;

    return {
      porVertical: porVerticalRaw.map((v) => ({
        vertical: v._id ?? 'desconocido',
        reservas: v.reservas,
        porcentaje: Math.round((v.reservas / totalReservas) * 1000) / 10,
      })),
      porCiudad: porCiudadRaw
        .filter((c) => c._id)
        .map((c) => ({ ciudad: c._id, reservas: c.reservas })),
      topComercios: topComerciosRaw.map((c) => ({
        comercio: c.nombre,
        reservas: c.reservas,
        facturacion: Math.round(c.facturacion * 100) / 100,
      })),
      embudo: { registrados, conReserva: usuariosConReserva, pagaron },
    };
  }

  // ── Reportes financieros ─────────────────────────────────────────────────────

  async generarReporteFinanciero(filtros: FiltrosReporte): Promise<ReporteFinancieroDto> {
    const matchReservas: Record<string, unknown> = {
      estado: ReservaEstado.CONFIRMADA,
      createdAt: { $gte: filtros.fechaDesde, $lte: filtros.fechaHasta },
    };

    if (filtros.vertical) matchReservas['vertical'] = filtros.vertical;
    if (filtros.comercioId) matchReservas['comercioId'] = filtros.comercioId;

    const reservasIds = await this.reservaModel
      .find(matchReservas)
      .select('_id vertical')
      .lean()
      .exec() as unknown as ReservaLean[];

    const reservaIdsArr = reservasIds.map((r) => r._id);

    const pagos = await this.pagoModel
      .find({ reservaId: { $in: reservaIdsArr }, estado: PagoEstado.APROBADO })
      .lean()
      .exec() as PagoLean[];

    const totales = pagos.reduce(
      (acc, pago) => ({
        gmv: acc.gmv + pago.montoTotal,
        ingresosPlataforma: acc.ingresosPlataforma + pago.comisionPlataforma,
        costoStripe: acc.costoStripe + pago.stripeFee,
        liquidacionesComercio: acc.liquidacionesComercio + pago.montoLiquidacion,
      }),
      { gmv: 0, ingresosPlataforma: 0, costoStripe: 0, liquidacionesComercio: 0 },
    );

    const porVertical = this.agruparPorVertical(pagos, reservasIds);

    return {
      fechaDesde: filtros.fechaDesde.toISOString(),
      fechaHasta: filtros.fechaHasta.toISOString(),
      gmv: Math.round(totales.gmv * 100) / 100,
      ingresosPlataforma: Math.round(totales.ingresosPlataforma * 100) / 100,
      costoStripe: Math.round(totales.costoStripe * 100) / 100,
      margenNetoPlataforma: Math.round((totales.ingresosPlataforma - totales.costoStripe) * 100) / 100,
      liquidacionesComercio: Math.round(totales.liquidacionesComercio * 100) / 100,
      totalReservas: reservaIdsArr.length,
      porVertical,
    };
  }

  private agruparPorVertical(pagos: PagoLean[], reservas: ReservaLean[]): ReporteVerticalDto[] {
    const reservaVerticalMap = new Map(reservas.map((r) => [r._id.toString(), r.vertical]));
    const acumulador = new Map<string, ReporteVerticalDto>();

    for (const pago of pagos) {
      const vertical = reservaVerticalMap.get(pago.reservaId.toString()) ?? 'unknown';
      const entrada = acumulador.get(vertical) ?? {
        vertical, gmv: 0, comision: 0, costoStripe: 0, margenNeto: 0, totalReservas: 0,
      };

      entrada.gmv += pago.montoTotal;
      entrada.comision += pago.comisionPlataforma;
      entrada.costoStripe += pago.stripeFee;
      entrada.margenNeto += pago.comisionPlataforma - pago.stripeFee;
      entrada.totalReservas += 1;

      acumulador.set(vertical, entrada);
    }

    return Array.from(acumulador.values()).map((v) => ({
      ...v,
      gmv: Math.round(v.gmv * 100) / 100,
      comision: Math.round(v.comision * 100) / 100,
      costoStripe: Math.round(v.costoStripe * 100) / 100,
      margenNeto: Math.round(v.margenNeto * 100) / 100,
    }));
  }
}
