import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { AlphaRepository } from '../alpha/alpha.repository';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { UsersRepository } from '../users/users.repository';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { Comercio } from '../comercios/comercio.schema';
import { Perro, PerroDocument } from '../perros/perro.schema';
import { Resena, ResenaDocument } from '../reviews/resena.schema';
import { Incidencia, IncidenciaDocument } from '../incidencias/incidencia.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { ActualizarAlphaNivelDto, ActualizarComisionDto, AlphaNivelDto, EntidadAuditada, ReporteFinancieroDto, ReporteVerticalDto, PagoEstado, ReservaEstado, Rol, VerticalKey } from 'shared';
import { ComisionConfigDocument } from '../comision-configs/comision-config.schema';
import { AlphaNivelConfigDocument } from '../alpha/alpha-nivel.schema';
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

/** Usuario del listado del admin, con reservas y nivel Alpha si es cliente. */
export interface UsuarioAdminDto extends Usuario {
  _id: Types.ObjectId;
  reservas?: number;
  nivelAlpha?: string;
}

interface ReservaEnriquecidaLean extends ReservaLean {
  fechaInicio?: Date;
  comisionMonto?: number;
  usuarioId?: { nombre?: string; email?: string };
  comercioId?: { nombreComercial?: string };
  servicioId?: { titulo?: string };
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
    private readonly alphaRepo: AlphaRepository,
    private readonly auditoria: AuditoriaService,
    private readonly comerciosRepo: ComerciosRepository,
    private readonly usersRepo: UsersRepository,
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
    @InjectModel(Resena.name) private readonly resenaModel: Model<ResenaDocument>,
    @InjectModel(Incidencia.name) private readonly incidenciaModel: Model<IncidenciaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModelAdmin: Model<ServicioDocument>,
  ) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  async obtenerDashboard(rango?: { desde: Date; hasta: Date }): Promise<{
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
      servicio: string;
      comisionMonto: number;
    }>;
    comisiones: ComisionConfigDocument[];
    periodo: { desde: Date; hasta: Date };
    comparativa: { gmvPct: number | null; ingresosPct: number | null; reservasPct: number | null; comerciosPct: number | null };
  }> {
    // Sin rango explícito se mira el mes en curso, que es lo que se veía antes
    // de que el dashboard tuviera selector de periodo (TCK-8030).
    const ahora = new Date();
    const inicioMes = rango?.desde ?? new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const finPeriodo = rango?.hasta ?? ahora;
    const enPeriodo = { $gte: inicioMes, $lte: finPeriodo };

    // Ventana anterior de la misma duración, para el "+12 % vs. periodo anterior".
    const duracion = finPeriodo.getTime() - inicioMes.getTime();
    const inicioPrevio = new Date(inicioMes.getTime() - duracion);
    const enPeriodoPrevio = { $gte: inicioPrevio, $lt: inicioMes };

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
      pagosPrevios,
      reservasPrevias,
      comerciosPrevios,
    ] = await Promise.all([
      this.reservaModel.countDocuments().exec(),
      this.usersRepo.contarTodos(),
      this.comerciosRepo.listar({ estado: 'pendiente' }),
      this.reservaModel
        .find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('codigo vertical montoTotal comisionMonto estado createdAt fechaInicio')
        .populate('usuarioId', 'nombre')
        .populate('comercioId', 'nombreComercial')
        .populate('servicioId', 'titulo')
        .lean()
        .exec() as unknown as Promise<ReservaEnriquecidaLean[]>,
      this.pagoModel.aggregate<{ gmv: number; ingresos: number }>([
        { $match: { estado: PagoEstado.APROBADO, createdAt: enPeriodo } },
        { $group: { _id: null, gmv: { $sum: '$montoTotal' }, ingresos: { $sum: '$comisionPlataforma' } } },
      ]).exec(),
      this.comisionConfigRepo.listarTodas(),
      this.comercioModel.countDocuments({ 'verificacion.estado': 'pendiente' }).exec(),
      this.comercioModel.countDocuments({ createdAt: enPeriodo }).exec(),
      this.perroModel.countDocuments().exec(),
      this.reservaModel.countDocuments({ createdAt: enPeriodo }).exec(),
      this.reservaModel.countDocuments({ createdAt: enPeriodo, estado: ReservaEstado.CANCELADA }).exec(),
      this.reservaModel.aggregate<{ monto: number; count: number }>([
        { $match: { estado: ReservaEstado.PAGO_RETENIDO } },
        { $group: { _id: null, monto: { $sum: '$montoTotal' }, count: { $sum: 1 } } },
      ]).exec(),
      this.reservaModel.countDocuments({ estado: ReservaEstado.EN_DISPUTA }).exec(),
      this.pagoModel.aggregate<{ gmv: number; ingresos: number }>([
        { $match: { estado: PagoEstado.APROBADO, createdAt: enPeriodoPrevio } },
        { $group: { _id: null, gmv: { $sum: '$montoTotal' }, ingresos: { $sum: '$comisionPlataforma' } } },
      ]).exec(),
      this.reservaModel.countDocuments({ createdAt: enPeriodoPrevio }).exec(),
      this.comercioModel.countDocuments({ createdAt: enPeriodoPrevio }).exec(),
    ]);

    const gmvMes     = Math.round((pagosDelMes[0]?.gmv     ?? 0) * 100) / 100;
    const ingresosMes = Math.round((pagosDelMes[0]?.ingresos ?? 0) * 100) / 100;
    const tasaCancelacionMes = reservasDelMes > 0
      ? Math.round((canceladasDelMes / reservasDelMes) * 1000) / 10
      : 0;
    const pagosRetenidosMonto = Math.round((pagosRetenidosAgg[0]?.monto ?? 0) * 100) / 100;
    const pagosRetenidosCount = pagosRetenidosAgg[0]?.count ?? 0;

    // Sin datos en el periodo anterior no hay porcentaje que enseñar: un "+100 %"
    // desde cero engañaría más de lo que informa.
    const variacion = (actual: number, previo: number): number | null =>
      previo > 0 ? Math.round(((actual - previo) / previo) * 1000) / 10 : null;

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
        servicio: r.servicioId?.titulo ?? r.vertical,
        comisionMonto: r.comisionMonto ?? 0,
      })),
      comisiones,
      periodo: { desde: inicioMes, hasta: finPeriodo },
      comparativa: {
        gmvPct: variacion(gmvMes, Math.round((pagosPrevios[0]?.gmv ?? 0) * 100) / 100),
        ingresosPct: variacion(ingresosMes, Math.round((pagosPrevios[0]?.ingresos ?? 0) * 100) / 100),
        reservasPct: variacion(reservasDelMes, reservasPrevias),
        comerciosPct: variacion(nuevosComerciosMes, comerciosPrevios),
      },
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
    // Se lee el valor anterior antes de escribir: sin el "de cuánto a cuánto",
    // el historial no explica nada (TCK-8030 §8).
    const anteriores = await this.comisionConfigRepo.listarTodas();
    const previa = anteriores.find((c) => c.vertical === dto.vertical);

    const actualizada = await this.comisionConfigRepo.upsert(
      dto.vertical,
      {
        comisionPct: dto.comisionPct,
        stripePct: dto.stripePct,
        stripeFijoEur: dto.stripeFijoEur,
        activo: dto.activo,
      },
      adminId,
    );

    const antes = previa ? Math.round(previa.comisionPct * 1000) / 10 : null;
    const despues = Math.round(dto.comisionPct * 1000) / 10;
    if (antes !== despues) {
      await this.auditoria.registrar({
        actorId: adminId,
        entidad: EntidadAuditada.COMISION,
        entidadId: dto.vertical,
        descripcion: `Comisión de ${dto.vertical} ${antes === null ? 'fijada' : 'cambiada'} ${antes === null ? '' : `del ${antes} % `}al ${despues} %`.replace('  ', ' '),
        antes: previa ? { comisionPct: previa.comisionPct } : undefined,
        despues: { comisionPct: dto.comisionPct },
      });
    }

    return actualizada;
  }

  // ── Doogking Alpha ───────────────────────────────────────────────────────────

  async listarNivelesAlpha(): Promise<AlphaNivelDto[]> {
    return this.alphaRepo.listarNiveles();
  }

  async actualizarNivelAlpha(
    dto: ActualizarAlphaNivelDto,
    adminId: string,
  ): Promise<AlphaNivelConfigDocument> {
    const nivel = await this.alphaRepo.upsert(
      dto.nivel,
      {
        nombre: dto.nombre,
        reservasRequeridas: dto.reservasRequeridas,
        descuentoPct: dto.descuentoPct,
        beneficios: dto.beneficios,
      },
      adminId,
    );

    await this.auditoria.registrar({
      actorId: adminId,
      entidad: EntidadAuditada.ALPHA,
      entidadId: String(dto.nivel),
      descripcion: `Nivel ${dto.nombre} actualizado: ${dto.reservasRequeridas} reservas y ${Math.round(dto.descuentoPct * 100)} % de descuento`,
      despues: { ...dto },
    });

    return nivel;
  }

  // ── Comercios CRUD ───────────────────────────────────────────────────────────

  async listarComercios(
    page = 1,
    limite = 20,
    estado?: string,
    buscar?: string,
    alphaAdherido?: boolean,
  ): Promise<{ items: ComercioDocument[]; total: number }> {
    return this.comerciosRepo.listarPaginado(
      { estado: estado as EstadoComercio | undefined, buscar, alphaAdherido },
      page,
      limite,
    );
  }

  /** Contadores de la cabecera de Comercios (TCK-8034). */
  async resumenComercios(): Promise<{
    total: number;
    activos: number;
    pendientes: number;
    suspendidos: number;
    verificados: number;
  }> {
    const [total, activos, pendientes, suspendidos, verificados] = await Promise.all([
      this.comercioModel.countDocuments({}).exec(),
      this.comercioModel.countDocuments({ estado: 'activo' }).exec(),
      this.comercioModel.countDocuments({ estado: 'pendiente' }).exec(),
      this.comercioModel.countDocuments({ estado: 'suspendido' }).exec(),
      this.comercioModel.countDocuments({ 'verificacion.estado': 'verificado' }).exec(),
    ]);
    return { total, activos, pendientes, suspendidos, verificados };
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
    adminId?: string,
  ): Promise<ComercioDocument> {
    const comercio = await this.comerciosRepo.findById(id);
    if (!comercio) throw new NotFoundException('Comercio no encontrado');

    // Rechazar sin decir por qué deja al comercio sin saber qué corregir.
    if (estado === 'rechazado' && !motivo?.trim()) {
      throw new BadRequestException('Para rechazar la documentación hay que indicar el motivo');
    }

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

    if (adminId) {
      await this.auditoria.registrar({
        actorId: adminId,
        entidad: EntidadAuditada.COMERCIO,
        entidadId: id,
        descripcion: `Documentación de ${comercio.nombreComercial} marcada como ${estado}`,
        motivo,
        antes: { verificacion: comercio.verificacion?.estado },
        despues: { verificacion: estado },
      });
    }

    return actualizado;
  }

  // ── Usuarios CRUD ────────────────────────────────────────────────────────────

  /**
   * Usuarios con lo que el admin necesita ver de un vistazo: reservas hechas y
   * nivel Alpha. El nivel **sólo se calcula para clientes**: Alpha es
   * fidelización de quien reserva, no de las empresas ni de la administración
   * (TCK-8035).
   */
  async listarUsuarios(
    page = 1,
    limite = 20,
    rol?: string,
    buscar?: string,
    verificado?: boolean,
  ): Promise<{ items: UsuarioAdminDto[]; total: number }> {
    const skip = (page - 1) * limite;
    const filtro: Record<string, unknown> = {};
    if (rol) filtro['rol'] = rol;
    if (verificado !== undefined) filtro['verificado'] = verificado;
    if (buscar) {
      const escaped = buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filtro['$or'] = [{ nombre: regex }, { email: regex }];
    }
    const [items, total] = await Promise.all([
      this.usuarioModel.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limite).lean().exec() as unknown as UsuarioDocument[],
      this.usuarioModel.countDocuments(filtro).exec(),
    ]);

    const clientes = items.filter((u) => u.rol === Rol.CLIENTE).map((u) => String(u._id));
    if (!clientes.length) return { items: items as UsuarioAdminDto[], total };

    const [porUsuario, niveles] = await Promise.all([
      this.reservaModel.aggregate<{ _id: Types.ObjectId; total: number; completadas: number }>([
        { $match: { usuarioId: { $in: clientes.map((id) => new Types.ObjectId(id)) } } },
        {
          $group: {
            _id: '$usuarioId',
            total: { $sum: 1 },
            completadas: {
              $sum: { $cond: [{ $eq: ['$estado', ReservaEstado.COMPLETADA] }, 1, 0] },
            },
          },
        },
      ]),
      this.alphaRepo.listarNiveles(),
    ]);

    const ordenados = [...niveles].sort((a, b) => a.reservasRequeridas - b.reservasRequeridas);
    const contadores = new Map(porUsuario.map((r) => [String(r._id), r]));

    return {
      items: items.map((usuario) => {
        if (usuario.rol !== Rol.CLIENTE) return usuario as UsuarioAdminDto;
        const contador = contadores.get(String(usuario._id));
        const completadas = contador?.completadas ?? 0;
        const nivel =
          [...ordenados].reverse().find((n) => completadas >= n.reservasRequeridas) ?? ordenados[0];
        return {
          ...(usuario as UsuarioAdminDto),
          reservas: contador?.total ?? 0,
          nivelAlpha: nivel?.nombre,
        };
      }),
      total,
    };
  }

  /** Contadores de la cabecera de Usuarios (TCK-8035 §1). */
  async resumenUsuarios(): Promise<{
    total: number;
    clientes: number;
    comercios: number;
    administradores: number;
    nuevosMes: number;
  }> {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [total, clientes, comercios, administradores, nuevosMes] = await Promise.all([
      this.usuarioModel.countDocuments({}).exec(),
      this.usuarioModel.countDocuments({ rol: Rol.CLIENTE }).exec(),
      this.usuarioModel.countDocuments({ rol: { $in: [Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF] } }).exec(),
      this.usuarioModel.countDocuments({ rol: Rol.ADMIN }).exec(),
      this.usuarioModel.countDocuments({ createdAt: { $gte: inicioMes } }).exec(),
    ]);
    return { total, clientes, comercios, administradores, nuevosMes };
  }

  /**
   * Ficha administrativa de una cuenta (TCK-8035 §5 y §6). Reúne en una sola
   * consulta lo que hay que mirar antes de tocar nada: qué ha reservado, qué ha
   * pagado, qué ha opinado y qué ha reclamado.
   */
  async fichaUsuario(id: string): Promise<Record<string, unknown>> {
    const usuario = await this.usersRepo.findById(id);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const usuarioObjectId = new Types.ObjectId(id);
    const esCliente = usuario.rol === Rol.CLIENTE;

    const [mascotas, reservas, gastado, resenas, incidencias, comercio] = await Promise.all([
      esCliente
        ? this.perroModel.find({ usuarioId: usuarioObjectId }).select('nombre raza').lean().exec() as unknown as Array<{ nombre: string; raza?: string }>
        : Promise.resolve([]),
      esCliente
        ? this.reservaModel
            .find({ usuarioId: usuarioObjectId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('codigo vertical estado montoTotal fechaInicio createdAt')
            .lean()
            .exec() as unknown as Array<Record<string, unknown>>
        : Promise.resolve([]),
      esCliente
        ? this.pagoModel.aggregate<{ total: number; pagos: number }>([
            { $match: { usuarioId: usuarioObjectId, estado: PagoEstado.APROBADO } },
            { $group: { _id: null, total: { $sum: '$montoTotal' }, pagos: { $sum: 1 } } },
          ]).exec()
        : Promise.resolve([]),
      esCliente ? this.resenaModel.countDocuments({ usuarioId: usuarioObjectId }).exec() : Promise.resolve(0),
      this.incidenciaModel.countDocuments({ abiertaPorId: usuarioObjectId }).exec(),
      usuario.comercioId ? this.comerciosRepo.findById(String(usuario.comercioId)) : Promise.resolve(null),
    ]);

    // Las canceladas cuentan como actividad, pero no como servicio disfrutado.
    const canceladas = reservas.filter((r) => r['estado'] === ReservaEstado.CANCELADA).length;

    return {
      usuario: {
        _id: String(usuario._id),
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: usuario.rol,
        verificado: usuario.verificado,
        permisosAdmin: usuario.permisosAdmin ?? [],
        createdAt: (usuario as unknown as { createdAt?: Date }).createdAt,
      },
      comercio: comercio
        ? { _id: String(comercio._id), nombreComercial: comercio.nombreComercial, estado: comercio.estado, plan: comercio.plan }
        : null,
      mascotas: mascotas.map((m) => ({ nombre: m.nombre, raza: m.raza })),
      reservas,
      resumen: {
        totalReservas: reservas.length,
        canceladas,
        totalGastado: Math.round((gastado[0]?.total ?? 0) * 100) / 100,
        pagos: gastado[0]?.pagos ?? 0,
        resenas,
        incidencias,
      },
    };
  }

  /** Ficha administrativa del comercio (TCK-8034). */
  async fichaComercio(id: string): Promise<Record<string, unknown>> {
    const comercio = await this.comerciosRepo.findById(id);
    if (!comercio) throw new NotFoundException('Comercio no encontrado');

    const comercioObjectId = new Types.ObjectId(id);
    const [servicios, reservas, facturacion, resenas, equipo, incidencias] = await Promise.all([
      this.servicioModelAdmin.countDocuments({ comercioId: comercioObjectId }).exec(),
      this.reservaModel
        .find({ comercioId: comercioObjectId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('codigo vertical estado montoTotal fechaInicio createdAt')
        .lean()
        .exec() as unknown as Array<Record<string, unknown>>,
      this.pagoModel.aggregate<{ total: number; comision: number }>([
        { $match: { estado: PagoEstado.APROBADO } },
        { $lookup: { from: 'reservas', localField: 'reservaId', foreignField: '_id', as: 'reserva' } },
        { $unwind: '$reserva' },
        { $match: { 'reserva.comercioId': comercioObjectId } },
        { $group: { _id: null, total: { $sum: '$montoTotal' }, comision: { $sum: '$comisionPlataforma' } } },
      ]).exec(),
      this.resenaModel.aggregate<{ media: number; total: number }>([
        { $match: { comercioId: comercioObjectId, eliminada: { $ne: true } } },
        { $group: { _id: null, media: { $avg: '$puntuacion' }, total: { $sum: 1 } } },
      ]).exec(),
      this.usuarioModel.countDocuments({ comercioId: comercioObjectId }).exec(),
      this.incidenciaModel.countDocuments({ comercioId: comercioObjectId }).exec(),
    ]);

    return {
      comercio: {
        _id: String(comercio._id),
        nombreComercial: comercio.nombreComercial,
        razonSocial: comercio.razonSocial,
        vatNumber: comercio.vatNumber,
        estado: comercio.estado,
        plan: comercio.plan,
        verticales: comercio.verticales,
        verificacion: comercio.verificacion,
        createdAt: (comercio as unknown as { createdAt?: Date }).createdAt,
      },
      reservas,
      resumen: {
        servicios,
        reservas: reservas.length,
        facturacion: Math.round((facturacion[0]?.total ?? 0) * 100) / 100,
        comision: Math.round((facturacion[0]?.comision ?? 0) * 100) / 100,
        valoracion: resenas[0]?.media ? Math.round(resenas[0].media * 10) / 10 : 0,
        resenas: resenas[0]?.total ?? 0,
        equipo,
        incidencias,
      },
    };
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
    datos: { nombre?: string; email?: string; telefono?: string; rol?: Rol; verificado?: boolean; comercioId?: string; permisosAdmin?: string[] },
    adminId?: string,
  ): Promise<UsuarioDocument> {
    const previo = await this.usersRepo.findById(id);
    const actualizado = await this.usersRepo.actualizarAdmin(id, datos);
    if (!actualizado) throw new NotFoundException('Usuario no encontrado');

    if (adminId) {
      await this.auditoria.registrar({
        actorId: adminId,
        entidad: EntidadAuditada.USUARIO,
        entidadId: id,
        descripcion: `Cuenta de ${actualizado.nombre} modificada`,
        antes: previo ? { rol: previo.rol, verificado: previo.verificado } : undefined,
        despues: { ...datos },
      });
    }

    return actualizado;
  }

  async eliminarUsuario(id: string, adminId?: string): Promise<void> {
    const previo = await this.usersRepo.findById(id);
    await this.usersRepo.eliminar(id);

    if (adminId) {
      await this.auditoria.registrar({
        actorId: adminId,
        entidad: EntidadAuditada.USUARIO,
        entidadId: id,
        descripcion: `Cuenta de ${previo?.nombre ?? 'un usuario'} eliminada`,
        antes: previo ? { nombre: previo.nombre, email: previo.email, rol: previo.rol } : undefined,
      });
    }
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
      const regex = new RegExp(escaped, 'i');
      // Buscar sólo por código obligaba a conocer la reserva de antemano; ahora
      // vale también el cliente (nombre o email) o el comercio (TCK-8036).
      const [usuarios, comercios] = await Promise.all([
        this.usuarioModel.find({ $or: [{ nombre: regex }, { email: regex }] }).select('_id').lean().exec() as unknown as Array<{ _id: Types.ObjectId }>,
        this.comercioModel.find({ nombreComercial: regex }).select('_id').lean().exec() as unknown as Array<{ _id: Types.ObjectId }>,
      ]);
      filtro['$or'] = [
        { codigo: regex },
        ...(usuarios.length ? [{ usuarioId: { $in: usuarios.map((u) => u._id) } }] : []),
        ...(comercios.length ? [{ comercioId: { $in: comercios.map((c) => c._id) } }] : []),
      ];
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
        .populate('servicioId', 'titulo')
        .lean()
        .exec() as unknown as ReservaEnriquecidaLean[],
      this.reservaModel.countDocuments(filtro).exec(),
    ]);

    // El estado del pago es otra cosa que el estado de la reserva: se resuelve
    // aparte para que la tabla pueda enseñarlos en columnas distintas (TCK-8036).
    // Con el pago viajan también el coste de Stripe y el neto del comercio, que
    // es lo que hay que poder explicar en la ficha de la reserva (TCK-8036 §6).
    const pagos = await this.pagoModel
      .find({ reservaId: { $in: items.map((r) => r._id) } })
      .select('reservaId estado stripeFee montoLiquidacion')
      .lean()
      .exec() as unknown as Array<{
        reservaId: Types.ObjectId; estado: string; stripeFee?: number; montoLiquidacion?: number;
      }>;
    const pagoPorReserva = new Map(pagos.map((p) => [String(p.reservaId), p]));

    const enriquecidas = items.map((r) => ({
      ...r,
      id: String(r._id),
      cliente: r.usuarioId?.nombre ?? 'Cliente',
      clienteEmail: r.usuarioId?.email,
      comercio: r.comercioId?.nombreComercial ?? 'Comercio',
      servicio: r.servicioId?.titulo ?? r.vertical,
      estadoPago: pagoPorReserva.get(String(r._id))?.estado ?? 'sin_pago',
      stripeFee: pagoPorReserva.get(String(r._id))?.stripeFee ?? 0,
      montoLiquidacion: pagoPorReserva.get(String(r._id))?.montoLiquidacion ?? 0,
      // El nombre viaja en la copia congelada del perro: sigue estando aunque
      // el cliente borre después su ficha.
      perroNombre: (r as unknown as { perroSnapshot?: Record<string, unknown> }).perroSnapshot?.['nombre'] as string | undefined,
      comisionMonto: (r as unknown as { comisionMonto?: number }).comisionMonto ?? 0,
    }));

    return { items: enriquecidas, total };
  }

  /**
   * Control del dinero: qué se ha cobrado, cuánto es del comercio, cuánto de
   * Doogking y cuánto se lleva la pasarela (TCK-8040 §1). Se calcula sobre los
   * pagos ya existentes; el historial de liquidaciones formales es aparte.
   */
  async listarPagos(
    page = 1,
    limite = 20,
    filtros: { estado?: string; comercioId?: string; buscar?: string } = {},
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const skip = (page - 1) * limite;
    const filtro: Record<string, unknown> = {};
    if (filtros.estado) filtro['estado'] = filtros.estado;

    // El pago no guarda el comercio: se llega a él por la reserva.
    if (filtros.comercioId || filtros.buscar) {
      const filtroReserva: Record<string, unknown> = {};
      if (filtros.comercioId) filtroReserva['comercioId'] = new Types.ObjectId(filtros.comercioId);
      if (filtros.buscar) {
        const escaped = filtros.buscar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtroReserva['codigo'] = new RegExp(escaped, 'i');
      }
      const reservas = await this.reservaModel.find(filtroReserva).select('_id').lean().exec() as unknown as Array<{ _id: Types.ObjectId }>;
      filtro['reservaId'] = { $in: reservas.map((r) => r._id) };
    }

    const [items, total] = await Promise.all([
      this.pagoModel
        .find(filtro)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limite)
        .populate('reservaId', 'codigo comercioId vertical')
        .lean()
        .exec() as unknown as Array<Record<string, unknown>>,
      this.pagoModel.countDocuments(filtro).exec(),
    ]);

    const comercioIds = items
      .map((p) => (p['reservaId'] as { comercioId?: Types.ObjectId } | undefined)?.comercioId)
      .filter((id): id is Types.ObjectId => !!id);
    const comercios = await this.comercioModel
      .find({ _id: { $in: comercioIds } })
      .select('nombreComercial')
      .lean()
      .exec() as unknown as Array<{ _id: Types.ObjectId; nombreComercial: string }>;
    const nombrePorComercio = new Map(comercios.map((c) => [String(c._id), c.nombreComercial]));

    return {
      items: items.map((pago) => {
        const reserva = pago['reservaId'] as { _id?: Types.ObjectId; codigo?: string; comercioId?: Types.ObjectId; vertical?: string } | undefined;
        return {
          _id: String(pago['_id']),
          codigoReserva: reserva?.codigo ?? '—',
          comercio: nombrePorComercio.get(String(reserva?.comercioId)) ?? 'Comercio',
          vertical: reserva?.vertical ?? '',
          montoTotal: pago['montoTotal'] ?? 0,
          comisionPlataforma: pago['comisionPlataforma'] ?? 0,
          stripeFee: pago['stripeFee'] ?? 0,
          montoLiquidacion: pago['montoLiquidacion'] ?? 0,
          estado: pago['estado'],
          createdAt: pago['createdAt'],
        };
      }),
      total,
    };
  }

  /** Totales de la cabecera de Pagos y liquidaciones (TCK-8040 §1). */
  async resumenPagos(): Promise<{
    cobrado: number;
    comisionDoogking: number;
    costePasarela: number;
    liquidadoComercios: number;
    pendienteLiquidar: number;
    reembolsado: number;
  }> {
    const sumar = async (match: Record<string, unknown>) => {
      const [fila] = await this.pagoModel.aggregate<{
        cobrado: number; comision: number; stripe: number; liquidacion: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: null,
            cobrado: { $sum: '$montoTotal' },
            comision: { $sum: '$comisionPlataforma' },
            stripe: { $sum: '$stripeFee' },
            liquidacion: { $sum: '$montoLiquidacion' },
          },
        },
      ]).exec();
      return fila ?? { cobrado: 0, comision: 0, stripe: 0, liquidacion: 0 };
    };

    const dosDecimales = (n: number): number => Math.round(n * 100) / 100;
    const [aprobados, reembolsados, retenidas] = await Promise.all([
      sumar({ estado: PagoEstado.APROBADO }),
      sumar({ estado: PagoEstado.REEMBOLSADO }),
      // Lo prestado que todavía no se ha liberado al comercio.
      this.reservaModel.aggregate<{ monto: number }>([
        { $match: { estado: { $in: [ReservaEstado.COMPLETADA, ReservaEstado.PAGO_RETENIDO] } } },
        { $group: { _id: null, monto: { $sum: '$montoTotal' } } },
      ]).exec(),
    ]);

    return {
      cobrado: dosDecimales(aprobados.cobrado),
      comisionDoogking: dosDecimales(aprobados.comision),
      costePasarela: dosDecimales(aprobados.stripe),
      liquidadoComercios: dosDecimales(aprobados.liquidacion),
      pendienteLiquidar: dosDecimales(retenidas[0]?.monto ?? 0),
      reembolsado: dosDecimales(reembolsados.cobrado),
    };
  }

  /** Contadores e importes de la cabecera del centro de reservas (TCK-8036). */
  async resumenReservas(): Promise<{
    porEstado: Record<string, number>;
    total: number;
    importeReservado: number;
    comisiones: number;
    pagosRetenidos: number;
    reembolsos: number;
  }> {
    const [porEstadoRaw, importes, retenidos, reembolsados] = await Promise.all([
      this.reservaModel.aggregate<{ _id: string; total: number }>([
        { $group: { _id: '$estado', total: { $sum: 1 } } },
      ]).exec(),
      this.reservaModel.aggregate<{ importe: number; comision: number }>([
        { $group: { _id: null, importe: { $sum: '$montoTotal' }, comision: { $sum: '$comisionMonto' } } },
      ]).exec(),
      this.reservaModel.aggregate<{ monto: number }>([
        { $match: { estado: ReservaEstado.PAGO_RETENIDO } },
        { $group: { _id: null, monto: { $sum: '$montoTotal' } } },
      ]).exec(),
      this.reservaModel.aggregate<{ monto: number }>([
        { $match: { estado: ReservaEstado.REEMBOLSADA } },
        { $group: { _id: null, monto: { $sum: '$montoTotal' } } },
      ]).exec(),
    ]);

    const dosDecimales = (n: number): number => Math.round(n * 100) / 100;
    const porEstado: Record<string, number> = {};
    let total = 0;
    for (const fila of porEstadoRaw) {
      porEstado[fila._id] = fila.total;
      total += fila.total;
    }

    return {
      porEstado,
      total,
      importeReservado: dosDecimales(importes[0]?.importe ?? 0),
      comisiones: dosDecimales(importes[0]?.comision ?? 0),
      pagosRetenidos: dosDecimales(retenidos[0]?.monto ?? 0),
      reembolsos: dosDecimales(reembolsados[0]?.monto ?? 0),
    };
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
  /**
   * Analítica global. Además del reparto por vertical/ciudad devuelve una fila
   * de KPIs y, por vertical y ciudad, facturación y comisión: sin eso la
   * pantalla enseñaba porcentajes sin dinero detrás (TCK-8031).
   */
  async obtenerAnalitica(): Promise<{
    kpis: {
      usuariosNuevosMes: number;
      reservas: number;
      conversionPct: number;
      facturacion: number;
      comision: number;
      ticketMedio: number;
    };
    porVertical: Array<{ vertical: string; reservas: number; porcentaje: number; facturacion: number; comision: number; comercios: number }>;
    porCiudad: Array<{ ciudad: string; reservas: number; comercios: number; facturacion: number }>;
    topComercios: Array<{ comercio: string; reservas: number; facturacion: number; valoracion: number }>;
    embudo: { registrados: number; conReserva: number; pagaron: number };
  }> {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [porVerticalRaw, porCiudadRaw, topComerciosRaw, registrados, usuariosConReserva, pagaron, usuariosNuevosMes, totales] = await Promise.all([
      this.reservaModel.aggregate<{ _id: string; reservas: number; facturacion: number; comision: number; comercios: string[] }>([
        {
          $group: {
            _id: '$vertical',
            reservas: { $sum: 1 },
            facturacion: { $sum: '$montoTotal' },
            comision: { $sum: '$comisionMonto' },
            comercios: { $addToSet: '$comercioId' },
          },
        },
        { $sort: { reservas: -1 } },
      ]).exec(),
      this.reservaModel.aggregate<{ _id: string; reservas: number; facturacion: number; comercios: string[] }>([
        { $lookup: { from: 'servicios', localField: 'servicioId', foreignField: '_id', as: 'servicio' } },
        { $unwind: '$servicio' },
        {
          $group: {
            _id: '$servicio.ubicacion.ciudad',
            reservas: { $sum: 1 },
            facturacion: { $sum: '$montoTotal' },
            comercios: { $addToSet: '$comercioId' },
          },
        },
        { $sort: { reservas: -1 } },
        { $limit: 15 },
      ]).exec(),
      this.pagoModel.aggregate<{ nombre: string; reservas: number; facturacion: number; valoracion?: number }>([
        { $match: { estado: PagoEstado.APROBADO } },
        { $lookup: { from: 'reservas', localField: 'reservaId', foreignField: '_id', as: 'reserva' } },
        { $unwind: '$reserva' },
        { $group: { _id: '$reserva.comercioId', facturacion: { $sum: '$montoTotal' }, reservas: { $sum: 1 } } },
        { $sort: { facturacion: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'comercios', localField: '_id', foreignField: '_id', as: 'comercio' } },
        { $unwind: '$comercio' },
        { $project: { _id: 0, nombre: '$comercio.nombreComercial', reservas: 1, facturacion: 1, valoracion: '$comercio.ratingPromedio' } },
      ]).exec(),
      this.usersRepo.contarTodos(),
      this.reservaModel.distinct('usuarioId').exec().then((ids) => ids.length),
      this.pagoModel.countDocuments({ estado: PagoEstado.APROBADO }).exec(),
      this.usuarioModel.countDocuments({ createdAt: { $gte: inicioMes } }).exec(),
      this.pagoModel.aggregate<{ facturacion: number; comision: number; pagos: number }>([
        { $match: { estado: PagoEstado.APROBADO } },
        { $group: { _id: null, facturacion: { $sum: '$montoTotal' }, comision: { $sum: '$comisionPlataforma' }, pagos: { $sum: 1 } } },
      ]).exec(),
    ]);

    const totalReservas = porVerticalRaw.reduce((s, v) => s + v.reservas, 0) || 1;
    const dosDecimales = (n: number): number => Math.round(n * 100) / 100;
    const facturacion = dosDecimales(totales[0]?.facturacion ?? 0);
    const pagosAprobados = totales[0]?.pagos ?? 0;

    return {
      kpis: {
        usuariosNuevosMes,
        reservas: totalReservas,
        // Conversión = quién llega a pagar de todo el que se registra.
        conversionPct: registrados > 0 ? Math.round((pagaron / registrados) * 1000) / 10 : 0,
        facturacion,
        comision: dosDecimales(totales[0]?.comision ?? 0),
        ticketMedio: pagosAprobados > 0 ? dosDecimales(facturacion / pagosAprobados) : 0,
      },
      porVertical: porVerticalRaw.map((v) => ({
        vertical: v._id ?? 'desconocido',
        reservas: v.reservas,
        porcentaje: Math.round((v.reservas / totalReservas) * 1000) / 10,
        facturacion: dosDecimales(v.facturacion ?? 0),
        comision: dosDecimales(v.comision ?? 0),
        comercios: v.comercios?.length ?? 0,
      })),
      porCiudad: porCiudadRaw
        .filter((c) => c._id)
        .map((c) => ({
          ciudad: c._id,
          reservas: c.reservas,
          comercios: c.comercios?.length ?? 0,
          facturacion: dosDecimales(c.facturacion ?? 0),
        })),
      topComercios: topComerciosRaw.map((c) => ({
        comercio: c.nombre,
        reservas: c.reservas,
        facturacion: dosDecimales(c.facturacion),
        valoracion: c.valoracion ?? 0,
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
