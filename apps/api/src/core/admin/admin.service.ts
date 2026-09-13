import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ComisionConfigRepository } from '../comision-configs/comision-config.repository';
import { AlphaRepository } from '../alpha/alpha.repository';
import { datosDeNivel } from '../alpha/alpha.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ComerciosRepository } from '../comercios/comercios.repository';
import { ComerciosService } from '../comercios/comercios.service';
import { UsersRepository } from '../users/users.repository';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Usuario, UsuarioDocument } from '../users/usuario.schema';
import { Comercio } from '../comercios/comercio.schema';
import { ComercioCuentaService, DIAS_GRACIA_BAJA_COMERCIO } from '../comercios/comercio-cuenta.service';

/**
 * Ventana para deshacer la baja de una cuenta. Se toma la misma que la de un
 * comercio a propósito: es la misma decisión —cerrar una cuenta y poder
 * arrepentirse— y dos plazos distintos sólo confundirían a quien opera.
 */
const DIAS_GRACIA_BAJA_USUARIO = DIAS_GRACIA_BAJA_COMERCIO;
import { Perro, PerroDocument } from '../perros/perro.schema';
import { Resena, ResenaDocument } from '../reviews/resena.schema';
import { Incidencia, IncidenciaDocument } from '../incidencias/incidencia.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Evento, EventoDocument } from '../eventos/evento.schema';
import { ActualizarAlphaNivelDto, ActualizarComisionDto, AlphaNivelDto, BajaComercioDetalleDto, ComercioDetalleDto, ComisionAplicadaDto, ConsentimientoDetalleDto, COMISION_PCT_DEFAULT, DetalleComercioDto, EntidadAuditada, ImpactoBajaComercioDto, IncidenciaDeComercioDto, MesDeComercioDto, MetricasComercioDto, MiembroDeComercioDto, MotivoBajaComercio, ResenaDeComercioDto, ReservaDeComercioDto, ResultadoBajaComercioDto, ResultadoBajaUsuarioDto, ReporteFinancieroDto, ReporteVerticalDto, ReporteAjustePorComercioDto, ServicioDeComercioDto, VerticalDeComercioDto, PagoEstado, ReservaEstado, Rol, TipoEvento, VerticalKey, regexLiteral } from 'shared';
import { ComisionConfigDocument } from '../comision-configs/comision-config.schema';
import { AlphaNivelConfigDocument } from '../alpha/alpha-nivel.schema';
import { BajaComercio, ComercioDocument, ConsentimientosComercio, EstadoComercio, PlanComercio } from '../comercios/comercio.schema';

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

interface ReservaConAjusteLean {
  _id: Types.ObjectId;
  vertical: string;
  comercioId: Types.ObjectId;
  suplementos?: Array<{ monto: number }>;
}

/** Importes de dinero: dos decimales, que es como se factura en euros. */
function dosDecimales(monto: number): number {
  return Math.round(monto * 100) / 100;
}

/** `Date`, cadena o nada → ISO, que es lo que espera el panel. */
function fechaIso(valor: unknown): string | undefined {
  if (valor instanceof Date) return valor.toISOString();
  return typeof valor === 'string' && valor ? valor : undefined;
}

/** Los doce meses `YYYY-MM` que empiezan en `desde`, incluido. */
function mesesDesde(desde: Date, cuantos = 12): string[] {
  return Array.from({ length: cuantos }, (_, indice) => {
    const mes = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + indice, 1));
    return `${mes.getUTCFullYear()}-${String(mes.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Listado del catálogo tal cual sale de Mongo, antes de mapearlo al DTO. */
interface ServicioLean {
  _id: Types.ObjectId;
  titulo: string;
  vertical: string;
  estado: string;
  destacado?: boolean;
  precioBase?: number;
  moneda?: string;
  ubicacion?: { ciudad?: string };
  imagenes?: string[];
  ratingPromedio?: number;
  'totalReseñas'?: number;
  createdAt?: Date;
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
  comercioId?: { nombreComercial?: string; politicaCancelacion?: string };
  servicioId?: { titulo?: string; politicaCancelacion?: string };
}

/** Filtros del listado de reservas del admin (TCK-8036 §2). */
export interface FiltrosReservasAdmin {
  estado?: string;
  comercioId?: string;
  /** Reservas de un listado concreto: lo usa la ficha del comercio. */
  servicioId?: string;
  buscar?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  vertical?: string;
  ciudad?: string;
  estadoPago?: string;
  importeMin?: number;
  importeMax?: number;
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
    private readonly comerciosService: ComerciosService,
    private readonly cuentaComercio: ComercioCuentaService,
    private readonly usersRepo: UsersRepository,
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
    @InjectModel(Resena.name) private readonly resenaModel: Model<ResenaDocument>,
    @InjectModel(Incidencia.name) private readonly incidenciaModel: Model<IncidenciaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModelAdmin: Model<ServicioDocument>,
    @InjectModel(Evento.name) private readonly eventoModel: Model<EventoDocument>,
  ) {}

  // ── Dashboard ────────────────────────────────────────────────────────────────

  async obtenerDashboard(rango?: { desde: Date; hasta: Date }): Promise<{
    kpis: {
      totalReservas: number;
      gmvMes: number;
      ingresosMes: number;
      comerciosPendientesCount: number;
      totalUsuarios: number;
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
      this.comercioModel.countDocuments({ createdAt: enPeriodo }).exec(),
      this.perroModel.countDocuments().exec(),
      this.reservaModel.countDocuments({ createdAt: enPeriodo }).exec(),
      this.reservaModel.countDocuments({ createdAt: enPeriodo, estado: ReservaEstado.CANCELADA }).exec(),
      this.reservaModel.aggregate<{ monto: number; count: number }>([
        { $match: { estado: ReservaEstado.PAGO_RETENIDO } },
        { $group: { _id: null, monto: { $sum: '$montoTotal' }, count: { $sum: 1 } } },
      ]).exec(),
      // Incidencias del módulo propio, no reservas marcadas en disputa: son
      // cosas distintas y el admin actúa sobre las primeras (TCK-8040 §2).
      this.incidenciaModel.countDocuments({ estado: { $in: ['abierta', 'en_revision'] } }).exec(),
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
    const nivel = await this.alphaRepo.upsert(dto.nivel, datosDeNivel(dto), adminId);

    await this.auditoria.registrar({
      actorId: adminId,
      entidad: EntidadAuditada.ALPHA,
      entidadId: String(dto.nivel),
      descripcion:
        `Nivel ${dto.nombre} actualizado: ${dto.reservasRequeridas} reservas y ` +
        `${Math.round(dto.descuentoPct * 100)} % de descuento` +
        (dto.descuentoMaximoEur ? ` (máximo ${dto.descuentoMaximoEur} €)` : '') +
        (dto.verticalesAplicables?.length
          ? `, sólo en ${dto.verticalesAplicables.join(', ')}`
          : ''),
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
    enPausa: number;
    dadosDeBaja: number;
  }> {
    // `total` cuenta el catálogo vivo: sumar los dados de baja inflaba la cifra
    // con negocios que ya no existen para nadie.
    const vivos = { estado: { $ne: 'eliminado' } };
    const [total, activos, pendientes, suspendidos, enPausa, dadosDeBaja] =
      await Promise.all([
        this.comercioModel.countDocuments(vivos).exec(),
        this.comercioModel.countDocuments({ estado: 'activo' }).exec(),
        this.comercioModel.countDocuments({ estado: 'pendiente' }).exec(),
        this.comercioModel.countDocuments({ estado: 'suspendido' }).exec(),
        this.comercioModel.countDocuments({ estado: 'inactivo' }).exec(),
        this.comercioModel.countDocuments({ estado: 'eliminado' }).exec(),
      ]);
    return { total, activos, pendientes, suspendidos, enPausa, dadosDeBaja };
  }

  async crearComercio(datos: {
    razonSocial: string;
    vatNumber: string;
    nombreComercial: string;
    verticales?: VerticalKey[];
    plan?: PlanComercio;
    estado?: EstadoComercio;
  }): Promise<ComercioDocument> {
    return this.comerciosRepo.crear({ ...datos, estado: datos.estado ?? 'activo' });
  }

  /**
   * Edición de la ficha desde el panel de plataforma.
   *
   * El estado **no se escribe aquí**, aunque el formulario lo mande: se delega
   * en `ComerciosService.cambiarEstado`. Escribirlo con el resto de los campos
   * era un `$set` a secas sobre `comercios`, y el buscador no mira ese estado
   * sino la copia denormalizada `comercioActivo` que cada listado lleva encima
   * (ver `Servicio.comercioActivo`). El resultado era el que reportó el cliente
   * el 10-09-2026: **negocios aprobados desde el editor que no aparecían en la
   * búsqueda**, porque sus listados seguían marcados como inactivos. Al revés
   * era peor: suspender desde aquí dejaba los listados visibles y reservables,
   * y además sin la nota de auditoría ni el motivo que exige TCK-8034.
   */
  async actualizarComercio(
    id: string,
    datos: {
      razonSocial?: string;
      nombreComercial?: string;
      verticales?: VerticalKey[];
      plan?: PlanComercio;
      estado?: EstadoComercio;
      comisionPctOverride?: number;
      /** Obligatorio para suspender, como en la acción dedicada (TCK-8034). */
      motivo?: string;
    },
    adminId?: string,
  ): Promise<ComercioDocument> {
    // La baja tiene su propio endpoint porque arrastra una cascada; fijarla a
    // mano desde aquí dejaría los listados y las cuentas del equipo vivos.
    if (datos.estado === 'eliminado') {
      throw new BadRequestException('Para dar de baja un comercio usa DELETE /admin/comercios/:id');
    }

    const { estado, motivo, ...campos } = datos;

    const actualizado = await this.comerciosRepo.actualizar(id, campos);
    if (!actualizado) throw new NotFoundException('Comercio no encontrado');

    // Sólo si de verdad cambia: guardar la ficha sin tocar el desplegable no
    // debe dejar una entrada de auditoría por cada edición.
    if (estado && estado !== actualizado.estado) {
      return this.comerciosService.cambiarEstado(id, estado, motivo, adminId);
    }
    return actualizado;
  }

  /**
   * Baja de un comercio desde el panel de plataforma.
   *
   * Antes esto era un `findByIdAndDelete` a secas: borraba el documento del
   * comercio y dejaba vivos sus listados (que el buscador filtra por el flag
   * denormalizado `comercioActivo`, no por el comercio) y las cuentas de su
   * equipo. De ahí que los comercios "eliminados" siguieran apareciendo en la
   * web. Ahora la baja pasa por `ComercioCuentaService`, que arrastra la
   * cascada completa.
   */
  async eliminarComercio(
    id: string,
    opciones: { motivo?: MotivoBajaComercio; comentario?: string; purgar?: boolean } = {},
    adminId?: string,
  ): Promise<ResultadoBajaComercioDto> {
    return this.cuentaComercio.darDeBaja(id, {
      motivo: opciones.motivo ?? MotivoBajaComercio.OTRO,
      comentario: opciones.comentario,
      purgar: opciones.purgar,
      origen: 'admin',
      actorId: adminId,
    });
  }

  /** Qué arrastraría la baja. El panel lo pinta antes de pedir confirmación. */
  async impactoBajaComercio(id: string): Promise<ImpactoBajaComercioDto> {
    return this.cuentaComercio.impacto(id);
  }

  /** Deshace una baja lógica: la cuenta vuelve en pausa, no publicada. */
  async restaurarComercio(id: string, adminId?: string): Promise<ComercioDocument> {
    return this.cuentaComercio.restaurar(id, adminId);
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
    incluirBajas = false,
  ): Promise<{ items: UsuarioAdminDto[]; total: number }> {
    const skip = (page - 1) * limite;
    // Las cuentas dadas de baja no salen en el listado normal: siguen ahí por
    // su historial, no para operar con ellas. Hay que pedirlas a propósito,
    // igual que en el listado de comercios.
    const filtro: Record<string, unknown> = incluirBajas
      ? { eliminadoAt: { $exists: true } }
      : { eliminadoAt: { $exists: false } };
    if (rol) filtro['rol'] = rol;
    if (verificado !== undefined) filtro['verificado'] = verificado;
    if (buscar) {
      const regex = regexLiteral(buscar);
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
        // El CIF de un comercio dado de baja se archiva cuando otro alta lo
        // reclama; la ficha sigue enseñándolo, que es para lo que se guarda.
        vatNumber: comercio.vatNumber ?? comercio.vatNumberBaja,
        estado: comercio.estado,
        plan: comercio.plan,
        verticales: comercio.verticales,
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

  /**
   * Ficha completa del comercio: la página de detalle del panel (`/admin/
   * comercios/:id`). El diálogo anterior sólo cabía siete cifras y diez
   * reservas, y para revisar un negocio hay que ver también su catálogo con lo
   * que factura cada listado, su equipo, sus reseñas y sus incidencias.
   *
   * Las reservas que viajan aquí son sólo las últimas: el listado completo se
   * pide paginado a `/admin/reservas?comercioId=`, que ya sabe filtrarlas.
   */
  async detalleComercio(id: string): Promise<DetalleComercioDto> {
    const comercio = await this.comerciosRepo.findById(id);
    if (!comercio) throw new NotFoundException('Comercio no encontrado');

    const comercioId = new Types.ObjectId(id);
    const [comisiones, metricas, servicios, reservas, equipo, resenas, incidencias] = await Promise.all([
      this.comisionesDeComercio(comercio),
      this.metricasDeComercio(comercioId),
      this.serviciosDeComercio(comercioId),
      this.ultimasReservasDeComercio(comercioId),
      this.equipoDeComercio(comercioId),
      this.resenasDeComercio(comercioId),
      this.incidenciasDeComercio(comercioId),
    ]);

    return {
      comercio: this.mapearComercioDetalle(comercio),
      comisiones, metricas, servicios, reservas, equipo, resenas, incidencias,
    };
  }

  /** Datos del negocio tal cual, salvo el IBAN (ver `enmascararIban`). */
  private mapearComercioDetalle(comercio: ComercioDocument): ComercioDetalleDto {
    const fechas = comercio as unknown as { createdAt?: Date; updatedAt?: Date };
    const banco = comercio.datosBancarios;

    return {
      _id: String(comercio._id),
      nombreComercial: comercio.nombreComercial,
      razonSocial: comercio.razonSocial,
      // El CIF de un comercio dado de baja se archiva cuando otro alta lo
      // reclama; la ficha sigue enseñándolo, que es para lo que se guarda.
      vatNumber: comercio.vatNumber ?? comercio.vatNumberBaja,
      descripcion: comercio.descripcion,
      verticales: comercio.verticales ?? [],
      plan: comercio.plan,
      estado: comercio.estado,
      modoLiquidacion: comercio.modoLiquidacion,
      comisionPctOverride: comercio.comisionPctOverride,
      socioFundador: !!comercio.socioFundador,
      comisionPctCongelada: comercio.comisionPctCongelada,
      congelacionHasta: comercio.congelacionHasta?.toISOString(),
      alphaAdherido: !!comercio.alphaAdherido,
      cohorte: comercio.cohorte,
      politicaCancelacion: comercio.politicaCancelacion,
      altaCompletada: !!comercio.altaCompletada,
      contacto: comercio.contacto,
      direccion: comercio.direccion,
      datosBancarios: banco
        ? { ...banco, iban: this.enmascararIban(banco.iban) }
        : undefined,
      consentimientos: this.mapearConsentimientos(comercio.consentimientos),
      preferenciasNotificacion: comercio.preferenciasNotificacion as unknown as Record<string, boolean>,
      baja: this.mapearBaja(comercio.baja),
      eliminadoAt: comercio.eliminadoAt?.toISOString(),
      createdAt: fechas.createdAt?.toISOString(),
      updatedAt: fechas.updatedAt?.toISOString(),
    };
  }

  /**
   * El panel necesita reconocer la cuenta bancaria, no copiarla: un IBAN entero
   * viajando a cada carga de la ficha es una filtración esperando a pasar, y
   * para conciliar una liquidación basta con los cuatro últimos dígitos.
   */
  private enmascararIban(iban?: string): string | undefined {
    const limpio = iban?.replace(/\s+/g, '');
    if (!limpio) return undefined;
    if (limpio.length <= 8) return limpio;

    return `${limpio.slice(0, 4)}${'•'.repeat(limpio.length - 8)}${limpio.slice(-4)}`;
  }

  private mapearConsentimientos(
    consentimientos?: ConsentimientosComercio,
  ): Record<string, ConsentimientoDetalleDto> | undefined {
    if (!consentimientos) return undefined;

    return Object.fromEntries(
      Object.entries(consentimientos).map(([clave, valor]) => [
        clave,
        { aceptado: !!valor?.aceptado, fecha: valor?.fecha?.toISOString(), version: valor?.version },
      ]),
    );
  }

  private mapearBaja(baja?: BajaComercio): BajaComercioDetalleDto | undefined {
    if (!baja) return undefined;

    return {
      motivo: baja.motivo,
      comentario: baja.comentario,
      fecha: baja.fecha instanceof Date ? baja.fecha.toISOString() : String(baja.fecha),
      origen: baja.origen,
      estadoPrevio: baja.estadoPrevio,
      reactivarEl: baja.reactivarEl,
      aceptaContacto: baja.aceptaContacto,
    };
  }

  /**
   * Qué porcentaje se le aplicaría hoy en cada vertical y por qué. Se recorre la
   * jerarquía de §11.2 sin el tramo por importe: ése depende del importe de cada
   * reserva y aquí no hay ninguna.
   */
  private async comisionesDeComercio(comercio: ComercioDocument): Promise<ComisionAplicadaDto[]> {
    const congelada = this.congelacionVigenteDe(comercio);

    return Promise.all((comercio.verticales ?? []).map(async (vertical) => {
      const config = await this.comisionConfigRepo.obtenerComisionEfectiva(vertical);
      const tarifas = { stripePct: config.stripePct, stripeFijoEur: config.stripeFijoEur };
      if (congelada != null) return { vertical, comisionPct: congelada, origen: 'socio_fundador' as const, ...tarifas };
      if (comercio.comisionPctOverride != null) {
        return { vertical, comisionPct: comercio.comisionPctOverride, origen: 'override_comercio' as const, ...tarifas };
      }
      if (config.comisionPct != null) {
        return { vertical, comisionPct: config.comisionPct, origen: 'vertical' as const, ...tarifas };
      }
      return { vertical, comisionPct: COMISION_PCT_DEFAULT, origen: 'defecto' as const, ...tarifas };
    }));
  }

  /** Comisión congelada de socio fundador, sólo si el compromiso sigue vivo. */
  private congelacionVigenteDe(comercio: ComercioDocument): number | null {
    if (!comercio.socioFundador || comercio.comisionPctCongelada == null) return null;
    if (comercio.congelacionHasta && comercio.congelacionHasta.getTime() <= Date.now()) return null;

    return comercio.comisionPctCongelada;
  }

  private async metricasDeComercio(comercioId: Types.ObjectId): Promise<MetricasComercioDto> {
    const [servicios, reservas, economia, resenas, incidencias, equipo, porVertical, mensual] = await Promise.all([
      this.metricaServicios(comercioId),
      this.metricaReservas(comercioId),
      this.metricaEconomia(comercioId),
      this.metricaResenas(comercioId),
      this.metricaIncidencias(comercioId),
      this.metricaEquipo(comercioId),
      this.metricaPorVertical(comercioId),
      this.metricaMensual(comercioId),
    ]);

    return { servicios, reservas, economia, resenas, incidencias, equipo, porVertical, mensual };
  }

  private async metricaServicios(comercioId: Types.ObjectId): Promise<MetricasComercioDto['servicios']> {
    const filas = await this.servicioModelAdmin.aggregate<{ _id: string; total: number; destacados: number }>([
      { $match: { comercioId } },
      { $group: { _id: '$estado', total: { $sum: 1 }, destacados: { $sum: { $cond: ['$destacado', 1, 0] } } } },
    ]).exec();
    const por = (estado: string): number => filas.find((f) => f._id === estado)?.total ?? 0;

    return {
      total: filas.reduce((suma, f) => suma + f.total, 0),
      publicados: por('publicado'),
      borradores: por('borrador'),
      pausados: por('pausado'),
      destacados: filas.reduce((suma, f) => suma + f.destacados, 0),
    };
  }

  private async metricaReservas(comercioId: Types.ObjectId): Promise<MetricasComercioDto['reservas']> {
    const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const vivos = { $in: AdminService.ESTADOS_RESERVA_VIVOS };
    const [filas, activas, ultimos30Dias, proximas] = await Promise.all([
      this.reservaModel.aggregate<{ _id: string; total: number }>([
        { $match: { comercioId } },
        { $group: { _id: '$estado', total: { $sum: 1 } } },
      ]).exec(),
      this.reservaModel.countDocuments({ comercioId, estado: vivos }).exec(),
      this.reservaModel.countDocuments({ comercioId, createdAt: { $gte: hace30Dias } }).exec(),
      this.reservaModel.countDocuments({ comercioId, estado: vivos, fechaInicio: { $gte: new Date() } }).exec(),
    ]);

    const porEstado = Object.fromEntries(filas.map((f) => [f._id, f.total]));
    return { total: filas.reduce((suma, f) => suma + f.total, 0), porEstado, activas, ultimos30Dias, proximas };
  }

  /**
   * El dinero se lee de los pagos, no de las reservas: el coste de Stripe y el
   * neto del comercio sólo existen ahí. Los pagos no guardan el comercio, así
   * que se llega a él por la reserva.
   */
  private async metricaEconomia(comercioId: Types.ObjectId): Promise<MetricasComercioDto['economia']> {
    const [totales] = await this.pagoModel.aggregate<{
      gmv: number; comision: number; stripeFee: number; liquidacion: number; pagos: number; reembolsado: number;
    }>([
      { $lookup: { from: 'reservas', localField: 'reservaId', foreignField: '_id', as: 'reserva' } },
      { $unwind: '$reserva' },
      { $match: { 'reserva.comercioId': comercioId, estado: { $in: [PagoEstado.APROBADO, PagoEstado.REEMBOLSADO] } } },
      { $group: {
        _id: null,
        gmv: { $sum: { $cond: [{ $eq: ['$estado', PagoEstado.APROBADO] }, '$montoTotal', 0] } },
        comision: { $sum: { $cond: [{ $eq: ['$estado', PagoEstado.APROBADO] }, '$comisionPlataforma', 0] } },
        stripeFee: { $sum: { $cond: [{ $eq: ['$estado', PagoEstado.APROBADO] }, '$stripeFee', 0] } },
        liquidacion: { $sum: { $cond: [{ $eq: ['$estado', PagoEstado.APROBADO] }, '$montoLiquidacion', 0] } },
        pagos: { $sum: { $cond: [{ $eq: ['$estado', PagoEstado.APROBADO] }, 1, 0] } },
        reembolsado: { $sum: { $cond: [{ $eq: ['$estado', PagoEstado.REEMBOLSADO] }, '$montoTotal', 0] } },
      } },
    ]).exec();

    const pagos = totales?.pagos ?? 0;
    return {
      gmv: dosDecimales(totales?.gmv ?? 0),
      comision: dosDecimales(totales?.comision ?? 0),
      stripeFee: dosDecimales(totales?.stripeFee ?? 0),
      liquidacion: dosDecimales(totales?.liquidacion ?? 0),
      ticketMedio: pagos ? dosDecimales((totales?.gmv ?? 0) / pagos) : 0,
      pagosAprobados: pagos,
      reembolsado: dosDecimales(totales?.reembolsado ?? 0),
    };
  }

  private async metricaResenas(comercioId: Types.ObjectId): Promise<MetricasComercioDto['resenas']> {
    const filas = await this.resenaModel.aggregate<{ _id: number; total: number; sinResponder: number }>([
      { $match: { comercioId, eliminada: { $ne: true } } },
      { $group: {
        _id: '$puntuacion',
        total: { $sum: 1 },
        sinResponder: { $sum: { $cond: [{ $ifNull: ['$respuesta', false] }, 0, 1] } },
      } },
    ]).exec();

    const total = filas.reduce((suma, f) => suma + f.total, 0);
    const suma = filas.reduce((acumulado, f) => acumulado + f._id * f.total, 0);
    return {
      media: total ? Math.round((suma / total) * 10) / 10 : 0,
      total,
      distribucion: Object.fromEntries(filas.map((f) => [String(f._id), f.total])),
      sinResponder: filas.reduce((acumulado, f) => acumulado + f.sinResponder, 0),
    };
  }

  private async metricaIncidencias(comercioId: Types.ObjectId): Promise<MetricasComercioDto['incidencias']> {
    const [total, abiertas] = await Promise.all([
      this.incidenciaModel.countDocuments({ comercioId }).exec(),
      this.incidenciaModel.countDocuments({ comercioId, estado: { $nin: ['resuelta', 'cerrada'] } }).exec(),
    ]);

    return { total, abiertas };
  }

  private async metricaEquipo(comercioId: Types.ObjectId): Promise<MetricasComercioDto['equipo']> {
    const filas = await this.usuarioModel.aggregate<{ _id: string; total: number }>([
      { $match: { comercioId } },
      { $group: { _id: '$rol', total: { $sum: 1 } } },
    ]).exec();

    return {
      total: filas.reduce((suma, f) => suma + f.total, 0),
      porRol: Object.fromEntries(filas.map((f) => [f._id, f.total])),
    };
  }

  /** Reparto del negocio por categoría: dónde tiene catálogo y de dónde cobra. */
  private async metricaPorVertical(comercioId: Types.ObjectId): Promise<VerticalDeComercioDto[]> {
    const [servicios, reservas] = await Promise.all([
      this.servicioModelAdmin.aggregate<{ _id: string; total: number }>([
        { $match: { comercioId } },
        { $group: { _id: '$vertical', total: { $sum: 1 } } },
      ]).exec(),
      this.reservaModel.aggregate<{ _id: string; reservas: number; gmv: number; comision: number }>([
        { $match: { comercioId } },
        { $group: {
          _id: '$vertical',
          reservas: { $sum: 1 },
          gmv: { $sum: { $cond: [AdminService.ES_FACTURABLE, '$montoTotal', 0] } },
          comision: { $sum: { $cond: [AdminService.ES_FACTURABLE, '$comisionMonto', 0] } },
        } },
      ]).exec(),
    ]);

    const verticales = [...new Set([...servicios.map((s) => s._id), ...reservas.map((r) => r._id)])];
    return verticales.map((vertical) => ({
      vertical,
      servicios: servicios.find((s) => s._id === vertical)?.total ?? 0,
      reservas: reservas.find((r) => r._id === vertical)?.reservas ?? 0,
      gmv: dosDecimales(reservas.find((r) => r._id === vertical)?.gmv ?? 0),
      comision: dosDecimales(reservas.find((r) => r._id === vertical)?.comision ?? 0),
    }));
  }

  /**
   * Doce meses corridos, con los vacíos incluidos: una serie con huecos se lee
   * como una caída de actividad que no ha existido.
   */
  private async metricaMensual(comercioId: Types.ObjectId): Promise<MesDeComercioDto[]> {
    const desde = new Date();
    desde.setUTCMonth(desde.getUTCMonth() - 11, 1);
    desde.setUTCHours(0, 0, 0, 0);

    const filas = await this.reservaModel.aggregate<{ _id: string; reservas: number; gmv: number; comision: number }>([
      { $match: { comercioId, createdAt: { $gte: desde } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        reservas: { $sum: 1 },
        gmv: { $sum: { $cond: [AdminService.ES_FACTURABLE, '$montoTotal', 0] } },
        comision: { $sum: { $cond: [AdminService.ES_FACTURABLE, '$comisionMonto', 0] } },
      } },
    ]).exec();

    return mesesDesde(desde).map((mes) => {
      const fila = filas.find((f) => f._id === mes);
      return { mes, reservas: fila?.reservas ?? 0, gmv: dosDecimales(fila?.gmv ?? 0), comision: dosDecimales(fila?.comision ?? 0) };
    });
  }

  /** Catálogo del comercio con lo que ha movido cada listado. */
  private async serviciosDeComercio(comercioId: Types.ObjectId): Promise<ServicioDeComercioDto[]> {
    const [servicios, actividad] = await Promise.all([
      this.servicioModelAdmin
        .find({ comercioId })
        .sort({ createdAt: -1 })
        .select('titulo vertical estado destacado precioBase moneda ubicacion imagenes ratingPromedio totalReseñas createdAt')
        .lean()
        .exec() as unknown as Promise<ServicioLean[]>,
      this.actividadPorServicio(comercioId),
    ]);

    return servicios.map((servicio) => {
      const suyo = actividad.get(String(servicio._id));
      return {
        _id: String(servicio._id),
        titulo: servicio.titulo,
        vertical: servicio.vertical,
        estado: servicio.estado,
        destacado: !!servicio.destacado,
        precioBase: servicio.precioBase ?? 0,
        moneda: servicio.moneda ?? 'EUR',
        ciudad: servicio.ubicacion?.ciudad,
        imagen: servicio.imagenes?.[0],
        ratingPromedio: servicio.ratingPromedio ?? 0,
        totalResenas: servicio['totalReseñas'] ?? 0,
        reservas: suyo?.reservas ?? 0,
        gmv: dosDecimales(suyo?.gmv ?? 0),
        ultimaReserva: suyo?.ultima?.toISOString(),
        createdAt: servicio.createdAt?.toISOString(),
      };
    });
  }

  private async actividadPorServicio(
    comercioId: Types.ObjectId,
  ): Promise<Map<string, { reservas: number; gmv: number; ultima?: Date }>> {
    const filas = await this.reservaModel.aggregate<{
      _id: Types.ObjectId; reservas: number; gmv: number; ultima: Date;
    }>([
      { $match: { comercioId } },
      { $group: {
        _id: '$servicioId',
        reservas: { $sum: 1 },
        gmv: { $sum: { $cond: [AdminService.ES_FACTURABLE, '$montoTotal', 0] } },
        ultima: { $max: '$createdAt' },
      } },
    ]).exec();

    return new Map(filas.map((f) => [String(f._id), f]));
  }

  /** Las últimas reservas, para el resumen; el listado completo va paginado. */
  private async ultimasReservasDeComercio(comercioId: Types.ObjectId): Promise<ReservaDeComercioDto[]> {
    const { items } = await this.listarReservas(1, 10, { comercioId: String(comercioId) });

    return items.map((reserva) => {
      const r = reserva as Record<string, unknown>;
      return {
        _id: String(r['_id']),
        codigo: String(r['codigo'] ?? ''),
        vertical: String(r['vertical'] ?? ''),
        servicio: r['servicio'] as string | undefined,
        cliente: String(r['cliente'] ?? ''),
        clienteEmail: r['clienteEmail'] as string | undefined,
        perro: r['perroNombre'] as string | undefined,
        estado: String(r['estado'] ?? ''),
        estadoPago: String(r['estadoPago'] ?? 'sin_pago'),
        fechaInicio: fechaIso(r['fechaInicio']),
        fechaFin: fechaIso(r['fechaFin']),
        cantidad: Number(r['cantidad'] ?? 1),
        montoTotal: Number(r['montoTotal'] ?? 0),
        comisionMonto: Number(r['comisionMonto'] ?? 0),
        stripeFee: Number(r['stripeFee'] ?? 0),
        montoLiquidacion: Number(r['montoLiquidacion'] ?? 0),
        createdAt: fechaIso(r['createdAt']) ?? '',
      };
    });
  }

  private async equipoDeComercio(comercioId: Types.ObjectId): Promise<MiembroDeComercioDto[]> {
    const miembros = await this.usuarioModel
      .find({ comercioId })
      .sort({ createdAt: 1 })
      .select('nombre email telefono rol verificado createdAt')
      .lean()
      .exec() as unknown as Array<Record<string, unknown>>;

    return miembros.map((m) => ({
      _id: String(m['_id']),
      nombre: String(m['nombre'] ?? ''),
      email: String(m['email'] ?? ''),
      telefono: m['telefono'] as string | undefined,
      rol: String(m['rol'] ?? ''),
      verificado: !!m['verificado'],
      createdAt: fechaIso(m['createdAt']),
    }));
  }

  private async resenasDeComercio(comercioId: Types.ObjectId): Promise<ResenaDeComercioDto[]> {
    const resenas = await this.resenaModel
      .find({ comercioId, eliminada: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('usuarioNombre servicioTitulo puntuacion comentario respuesta createdAt')
      .lean()
      .exec() as unknown as Array<Record<string, unknown>>;

    return resenas.map((r) => ({
      _id: String(r['_id']),
      usuarioNombre: String(r['usuarioNombre'] ?? 'Cliente'),
      servicioTitulo: String(r['servicioTitulo'] ?? ''),
      puntuacion: Number(r['puntuacion'] ?? 0),
      comentario: String(r['comentario'] ?? ''),
      respuesta: (r['respuesta'] as string | null | undefined) ?? null,
      createdAt: fechaIso(r['createdAt']),
    }));
  }

  private async incidenciasDeComercio(comercioId: Types.ObjectId): Promise<IncidenciaDeComercioDto[]> {
    const incidencias = await this.incidenciaModel
      .find({ comercioId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('asunto tipo estado origen abiertaPorNombre codigoReserva createdAt')
      .lean()
      .exec() as unknown as Array<Record<string, unknown>>;

    return incidencias.map((i) => ({
      _id: String(i['_id']),
      asunto: String(i['asunto'] ?? ''),
      tipo: String(i['tipo'] ?? ''),
      estado: String(i['estado'] ?? ''),
      origen: String(i['origen'] ?? ''),
      abiertaPorNombre: String(i['abiertaPorNombre'] ?? ''),
      codigoReserva: i['codigoReserva'] as string | undefined,
      createdAt: fechaIso(i['createdAt']),
    }));
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

    // Sin esta comprobación el índice único de `email` reventaba con un E11000
    // que nadie traduce, y el panel enseñaba un fallo del servidor en lugar de
    // decir lo único que pasaba: que esa dirección ya está dada de alta.
    const email = datos.email.trim().toLowerCase();
    if (await this.usersRepo.findByEmail(email)) {
      throw new ConflictException('Ya existe una cuenta con ese email.');
    }

    const passwordHash = await bcrypt.hash(datos.password, 10);
    return this.usersRepo.crear({
      nombre: datos.nombre,
      email,
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
    if (!previo) throw new NotFoundException('Usuario no encontrado');

    // Ampliarse las áreas propias convierte cualquier permiso en todos: quien
    // tiene el área de usuarios la usa para gestionar cuentas ajenas, no la
    // suya. Que se las cambie otro administrador sí vale.
    const esSuPropiaCuenta = !!adminId && adminId === String(previo._id);
    if (esSuPropiaCuenta && datos.permisosAdmin !== undefined) {
      throw new ForbiddenException(
        'No puedes cambiar tus propias áreas de administración; pídeselo a otro administrador.',
      );
    }

    // Bajarle el rol al último administrador deja el panel sin dueño y sin
    // forma de recuperarlo desde la propia aplicación.
    if (datos.rol && datos.rol !== Rol.ADMIN && previo.rol === Rol.ADMIN) {
      await this.exigirQueQuedeOtroAdmin(previo._id);
    }

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

  /**
   * Cierra una cuenta. Por defecto es **lógica**, igual que la de un comercio:
   * pierde el acceso pero conserva su historial, porque borrarla dejaría sin
   * autor las reservas que hizo y las reseñas que escribió, y se puede deshacer
   * dentro del periodo de gracia. Con `purgar` el borrado es físico y sólo vale
   * para datos de prueba.
   *
   * Antes de cualquiera de las dos hay que descartar las tres formas de dejar
   * la plataforma peor de lo que estaba: quedarse fuera uno mismo, quedarse sin
   * administradores y dejar reservas vivas sin cliente.
   */
  async eliminarUsuario(
    id: string,
    adminId?: string,
    opciones: { motivo?: string; purgar?: boolean } = {},
  ): Promise<ResultadoBajaUsuarioDto> {
    const previo = await this.usersRepo.findById(id);
    if (!previo) throw new NotFoundException('Usuario no encontrado');

    if (adminId && adminId === String(previo._id)) {
      throw new ConflictException(
        'No puedes eliminar tu propia cuenta: te quedarías sin acceso al panel.',
      );
    }

    if (previo.rol === Rol.ADMIN) {
      await this.exigirQueQuedeOtroAdmin(previo._id);
    }

    // Una reserva viva sin cliente deja al comercio con alguien a quien
    // atender y sin forma de contactarle, y descuadra el panel de reservas.
    const reservasVivas = await this.reservaModel.countDocuments({
      usuarioId: previo._id,
      estado: { $in: AdminService.ESTADOS_RESERVA_VIVOS },
    }).exec();
    if (reservasVivas > 0) {
      throw new ConflictException(
        `No se puede eliminar: la cuenta tiene ${reservasVivas} reserva(s) en curso. ` +
          'Resuélvelas antes de cerrarla.',
      );
    }

    if (opciones.purgar) {
      // Al revés que en un comercio, la purga no arrastra las reservas: son
      // facturación del comercio, que no puede evaporarse porque su cliente
      // borre la cuenta. Sin dueño quedarían huérfanas, así que con historial
      // el único camino es la baja lógica.
      const reservas = await this.reservaModel.countDocuments({ usuarioId: previo._id }).exec();
      if (reservas > 0) {
        throw new ConflictException(
          `No se puede borrar definitivamente: la cuenta tiene ${reservas} reserva(s) en el ` +
            'historial del comercio. Da de baja la cuenta en su lugar.',
        );
      }
      await this.usersRepo.eliminar(id);
    } else {
      await this.usersRepo.darDeBaja(id, { motivo: opciones.motivo, actorId: adminId });
    }

    if (adminId) {
      await this.auditoria.registrar({
        actorId: adminId,
        entidad: EntidadAuditada.USUARIO,
        entidadId: id,
        descripcion: opciones.purgar
          ? `Cuenta de ${previo.nombre} eliminada definitivamente`
          : `Cuenta de ${previo.nombre} dada de baja`,
        motivo: opciones.motivo,
        antes: { nombre: previo.nombre, email: previo.email, rol: previo.rol },
      });
    }

    return {
      usuarioId: id,
      nombre: previo.nombre,
      purgado: !!opciones.purgar,
      restaurableHasta: opciones.purgar
        ? undefined
        : new Date(Date.now() + DIAS_GRACIA_BAJA_USUARIO * 86_400_000).toISOString(),
    };
  }

  /**
   * Deshace una baja lógica. La cuenta vuelve activa con su historial intacto;
   * el `activo: true` es lo que le devuelve el acceso.
   */
  async restaurarUsuario(id: string, adminId?: string): Promise<UsuarioDocument> {
    const previo = await this.usersRepo.findById(id);
    if (!previo) throw new NotFoundException('Usuario no encontrado');
    if (!previo.eliminadoAt) {
      throw new ConflictException('La cuenta no está dada de baja.');
    }

    const restaurado = await this.usersRepo.restaurar(id);
    if (!restaurado) throw new NotFoundException('Usuario no encontrado');

    if (adminId) {
      await this.auditoria.registrar({
        actorId: adminId,
        entidad: EntidadAuditada.USUARIO,
        entidadId: id,
        descripcion: `Cuenta de ${previo.nombre} restaurada tras su baja`,
        antes: { estado: 'dada de baja' },
        despues: { estado: 'activa' },
      });
    }

    return restaurado;
  }

  // ── Listados admin ───────────────────────────────────────────────────────────

  async listarReservas(
    page = 1,
    limite = 20,
    filtros: FiltrosReservasAdmin = {},
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const skip = (page - 1) * limite;
    const filtro: Record<string, unknown> = {};
    if (filtros.estado) filtro['estado'] = filtros.estado;
    if (filtros.comercioId) filtro['comercioId'] = filtros.comercioId;
    if (filtros.servicioId) filtro['servicioId'] = filtros.servicioId;
    if (filtros.vertical) filtro['vertical'] = filtros.vertical;
    if (filtros.buscar) {
      const regex = regexLiteral(filtros.buscar);
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
    if (filtros.importeMin != null || filtros.importeMax != null) {
      const rango: Record<string, number> = {};
      if (filtros.importeMin != null) rango['$gte'] = filtros.importeMin;
      if (filtros.importeMax != null) rango['$lte'] = filtros.importeMax;
      filtro['montoTotal'] = rango;
    }
    // La reserva no guarda la ciudad: se llega a ella por el servicio, que es
    // donde vive la ubicación (TCK-8036 §2).
    // Con un servicio ya elegido la ciudad no aporta nada y además pisaría el
    // mismo campo del filtro, así que sólo se resuelve cuando no lo hay.
    if (filtros.ciudad && !filtros.servicioId) {
      const servicios = await this.servicioModelAdmin
        .find({ 'ubicacion.ciudad': regexLiteral(filtros.ciudad) })
        .select('_id')
        .lean()
        .exec() as unknown as Array<{ _id: Types.ObjectId }>;
      filtro['servicioId'] = { $in: servicios.map((s) => s._id) };
    }
    // El estado del pago vive en otra colección: se resuelven antes las reservas
    // que lo cumplen para poder filtrar por él sin desnormalizar el dato.
    if (filtros.estadoPago) {
      const pagosFiltrados = await this.pagoModel
        .find({ estado: filtros.estadoPago })
        .select('reservaId')
        .lean()
        .exec() as unknown as Array<{ reservaId: Types.ObjectId }>;
      filtro['_id'] = { $in: pagosFiltrados.map((p) => p.reservaId) };
    }

    const [items, total] = await Promise.all([
      this.reservaModel
        .find(filtro)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limite)
        .populate('usuarioId', 'nombre email')
        .populate('comercioId', 'nombreComercial politicaCancelacion')
        .populate('servicioId', 'titulo politicaCancelacion')
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
      // Política de cancelación que rige la reserva (TCK-8036 §6): la del
      // servicio si la tiene escrita, y si no la que el comercio declara.
      politicaCancelacion: r.servicioId?.politicaCancelacion ?? r.comercioId?.politicaCancelacion,
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
        filtroReserva['codigo'] = regexLiteral(filtros.buscar);
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

  /**
   * Reservas que cuentan como facturación. Antes el informe miraba sólo
   * `confirmada`, y eso hacía **desaparecer** el dinero ya cobrado en cuanto la
   * reserva avanzaba: al completar el servicio o liberar el pago, su GMV, su
   * comisión y su liquidación salían del informe con el que se factura al
   * comercio, así que el periodo se vaciaba solo con el paso de los días.
   *
   * Quedan fuera las que no llegaron a cobrarse (`pendiente`) y aquellas cuyo
   * dinero se devolvió (`cancelada`, `reembolsada`). Las que están en disputa
   * siguen dentro hasta que se resuelvan: el cobro existe.
   */
  private static readonly ESTADOS_FACTURABLES = [
    ReservaEstado.CONFIRMADA,
    ReservaEstado.AJUSTE_SOLICITADO,
    ReservaEstado.EN_CURSO,
    ReservaEstado.COMPLETADA,
    ReservaEstado.NO_SHOW,
    ReservaEstado.PAGO_RETENIDO,
    ReservaEstado.PAGO_LIBERADO,
    ReservaEstado.EN_DISPUTA,
  ];

  /**
   * La misma regla, escrita como expresión de agregación: `$cond` necesita un
   * booleano, no un filtro, y repetir el `$in` en cada `$group` acabaría
   * separándolo de la lista de arriba.
   */
  private static get ES_FACTURABLE(): Record<string, unknown> {
    return { $in: ['$estado', AdminService.ESTADOS_FACTURABLES] };
  }

  /** Reservas que aún esperan algo: no pueden quedarse sin cliente ni sin comercio. */
  private static readonly ESTADOS_RESERVA_VIVOS = [
    ReservaEstado.PENDIENTE,
    ReservaEstado.CONFIRMADA,
    ReservaEstado.AJUSTE_SOLICITADO,
    ReservaEstado.EN_CURSO,
    ReservaEstado.PAGO_RETENIDO,
    ReservaEstado.EN_DISPUTA,
  ];

  /**
   * Ningún camino del panel puede dejar la plataforma sin administradores.
   * Se excluye por el `_id` del propio documento, sin reconstruirlo desde la
   * cadena de la ruta: Mongoose ya lo entrega tipado y así la comprobación no
   * depende del formato con el que llegó el identificador.
   */
  private async exigirQueQuedeOtroAdmin(excluyendo: unknown): Promise<void> {
    // Sólo cuentan los que pueden entrar: una cuenta dada de baja o desactivada
    // sigue teniendo `rol: admin` en la colección pero no abre sesión, así que
    // contarla dejaría la plataforma sin nadie que la administre.
    const otros = await this.usuarioModel.countDocuments({
      rol: Rol.ADMIN,
      _id: { $ne: excluyendo },
      activo: { $ne: false },
      eliminadoAt: { $exists: false },
    }).exec();

    if (otros === 0) {
      throw new ConflictException(
        'Es el único administrador de la plataforma: crea otro antes de quitarle el acceso.',
      );
    }
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
    embudo: {
      registrados: number; busquedas: number; visitasFicha: number;
      conReserva: number; pagaron: number; completaron: number;
    };
  }> {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [
      porVerticalRaw, porCiudadRaw, topComerciosRaw, registrados, usuariosConReserva,
      pagaron, usuariosNuevosMes, totales, busquedas, visitasFicha, completaron,
    ] = await Promise.all([
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
      // Los dos primeros peldaños del embudo se cuentan por sesión, no por
      // evento: quien busca cinco veces sigue siendo una persona (TCK-8031).
      this.eventoModel.distinct('sesionId', { tipo: TipoEvento.BUSQUEDA_INICIADA }).exec().then((ids) => ids.length),
      this.eventoModel.distinct('sesionId', { tipo: TipoEvento.SERVICIO_ABIERTO }).exec().then((ids) => ids.length),
      this.reservaModel.countDocuments({ estado: ReservaEstado.COMPLETADA }).exec(),
    ]);

    const totalReservas = porVerticalRaw.reduce((s, v) => s + v.reservas, 0) || 1;
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
      embudo: {
        registrados, busquedas, visitasFicha,
        conReserva: usuariosConReserva, pagaron, completaron,
      },
    };
  }

  /**
   * Serie diaria de reservas y facturación (TCK-8031 §1). Se rellenan los días
   * sin actividad con ceros: una línea con huecos miente sobre la tendencia.
   */
  async evolucion(dias = 30): Promise<Array<{ fecha: string; reservas: number; facturacion: number }>> {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (dias - 1));

    const [reservasPorDia, pagosPorDia] = await Promise.all([
      this.reservaModel.aggregate<{ _id: string; total: number }>([
        { $match: { createdAt: { $gte: desde } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: 1 } } },
      ]).exec(),
      this.pagoModel.aggregate<{ _id: string; total: number }>([
        { $match: { estado: PagoEstado.APROBADO, createdAt: { $gte: desde } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$montoTotal' } } },
      ]).exec(),
    ]);

    const reservas = new Map(reservasPorDia.map((r) => [r._id, r.total]));
    const facturacion = new Map(pagosPorDia.map((p) => [p._id, p.total]));

    return Array.from({ length: dias }, (_, i) => {
      const dia = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
      const clave = dia.toISOString().slice(0, 10);
      return {
        fecha: clave,
        reservas: reservas.get(clave) ?? 0,
        facturacion: Math.round((facturacion.get(clave) ?? 0) * 100) / 100,
      };
    });
  }

  // ── Reportes financieros ─────────────────────────────────────────────────────

  async generarReporteFinanciero(filtros: FiltrosReporte): Promise<ReporteFinancieroDto> {
    const matchReservas: Record<string, unknown> = {
      estado: { $in: AdminService.ESTADOS_FACTURABLES },
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
    const ajustes = await this.generarReporteAjustes(matchReservas);

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
      ...ajustes,
    };
  }

  /**
   * Frecuencia e impacto económico de los ajustes de precio, agrupados por comercio
   * (Ref. S11) — ayuda a detectar negocios que ajustan precios con frecuencia fuera de
   * lo normal. Usa el mismo filtro de fechas/vertical/comercio que el resto del reporte.
   */
  private async generarReporteAjustes(matchReservas: Record<string, unknown>): Promise<{
    totalReservasConAjuste: number;
    importeTotalAjustes: number;
    ajustesPorComercio: ReporteAjustePorComercioDto[];
  }> {
    const reservas = await this.reservaModel
      .find(matchReservas)
      .select('vertical comercioId suplementos')
      .lean()
      .exec() as unknown as ReservaConAjusteLean[];

    const comercioIds = [...new Set(reservas.map((r) => r.comercioId.toString()))];
    const comercios = await this.comercioModel
      .find({ _id: { $in: comercioIds } })
      .select('nombreComercial')
      .lean()
      .exec() as unknown as Array<{ _id: Types.ObjectId; nombreComercial?: string }>;
    const nombrePorComercio = new Map(comercios.map((c) => [c._id.toString(), c.nombreComercial ?? 'Sin nombre']));

    const acumulador = new Map<string, ReporteAjustePorComercioDto>();
    let totalReservasConAjuste = 0;
    let importeTotalAjustes = 0;

    for (const reserva of reservas) {
      const comercioId = reserva.comercioId.toString();
      const entrada = acumulador.get(comercioId) ?? {
        comercioId,
        comercioNombre: nombrePorComercio.get(comercioId) ?? 'Sin nombre',
        totalReservas: 0,
        reservasConAjuste: 0,
        importeAjustes: 0,
        porcentajeConAjuste: 0,
      };

      entrada.totalReservas += 1;
      const importeReserva = (reserva.suplementos ?? []).reduce((suma, s) => suma + s.monto, 0);
      if (importeReserva > 0) {
        entrada.reservasConAjuste += 1;
        entrada.importeAjustes += importeReserva;
        totalReservasConAjuste += 1;
        importeTotalAjustes += importeReserva;
      }

      acumulador.set(comercioId, entrada);
    }

    const ajustesPorComercio = Array.from(acumulador.values())
      .map((c) => ({
        ...c,
        importeAjustes: Math.round(c.importeAjustes * 100) / 100,
        porcentajeConAjuste: c.totalReservas > 0
          ? Math.round((c.reservasConAjuste / c.totalReservas) * 1000) / 10
          : 0,
      }))
      .filter((c) => c.reservasConAjuste > 0)
      .sort((a, b) => b.porcentajeConAjuste - a.porcentajeConAjuste);

    return {
      totalReservasConAjuste,
      importeTotalAjustes: Math.round(importeTotalAjustes * 100) / 100,
      ajustesPorComercio,
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
