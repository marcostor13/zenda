import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActualizarRegistroServicioDto, CrearRegistroServicioDto, HISTORIAL_ORIGEN, ReservaEstado,
  TipoHistorial, VerticalKey, limpiarDatosRegistro, tieneHistorialDeServicio,
} from 'shared';
import { Perro, PerroDocument } from '../perros/perro.schema';
import { PerroHistorial, PerroHistorialDocument } from '../perros/perro-historial.schema';
import { PerrosService } from '../perros/perros.service';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Comercio, ComercioDocument } from '../comercios/comercio.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { UsersRepository } from '../users/users.repository';
import { InformeDescargable, InformePerroService } from '../perros/informe/informe-perro.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  ContactoPropietario, ExpedienteMascota, MascotaComercioResumen, RegistroExpediente,
  ServicioExpediente,
} from './expediente.types';

/** Quién escribe un registro: el comercio y el usuario concreto del equipo. */
export interface AutorRegistro {
  comercioId: string;
  usuarioId: string;
}

interface GrupoReservasPerro {
  _id: Types.ObjectId;
  totalReservas: number;
  serviciosCompletados: number;
  ultimoServicio?: Date;
  verticales: string[];
}

type HistorialPlano = PerroHistorial & { _id: Types.ObjectId; createdAt?: Date };
type ReservaPlana = Pick<Reserva, 'codigo' | 'vertical' | 'servicioId' | 'comercioId' | 'fechaInicio' | 'fechaFin' | 'estado'> & { _id: Types.ObjectId };
type PerroPlano = Perro & { _id: Types.ObjectId };

/** Estados que no llegaron a ser un servicio: no cuentan en el expediente del dueño. */
const ESTADOS_SIN_SERVICIO = [ReservaEstado.PENDIENTE, ReservaEstado.CANCELADA, ReservaEstado.REEMBOLSADA];

const CAMPOS_TARJETA = 'nombre fotos raza fechaNacimiento sexo peso tamano propietarioId alergias enfermedades medicacion';
const CAMPOS_RESERVA = 'codigo vertical servicioId comercioId fechaInicio fechaFin estado';

/**
 * Expediente de la mascota: la ficha que rellena el dueño más lo que anotan los
 * profesionales que la atienden. Lo consultan dos públicos con reglas distintas:
 * el dueño lo ve todo; el comercio, sólo si la mascota ha reservado con él.
 */
@Injectable()
export class ExpedientesService {
  constructor(
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
    @InjectModel(PerroHistorial.name) private readonly historialModel: Model<PerroHistorialDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    private readonly usersRepo: UsersRepository,
    private readonly perrosService: PerrosService,
    private readonly informes: InformePerroService,
  ) {}

  // ── Panel del comercio ─────────────────────────────────────────────────────

  async listarMascotasComercio(comercioId: string, busqueda?: string): Promise<MascotaComercioResumen[]> {
    const comercio = aObjectId(comercioId, 'Identificador de comercio');
    const grupos = await this.agruparReservasPorPerro(comercio);
    if (!grupos.length) return [];

    const perroIds = grupos.map((g) => g._id);
    const [perros, registros] = await Promise.all([
      this.perroModel.find({ _id: { $in: perroIds } }).select(CAMPOS_TARJETA).lean().exec() as unknown as Promise<PerroPlano[]>,
      this.contarRegistros(comercio, perroIds),
    ]);
    const propietarios = await this.contactosPorId(perros.map((p) => String(p.propietarioId)));
    const porPerro = new Map(perros.map((p) => [String(p._id), p]));

    const mascotas = grupos
      .filter((g) => porPerro.has(String(g._id)))
      .map((g) => aResumen(g, porPerro.get(String(g._id))!, propietarios, registros));

    return filtrarPorBusqueda(mascotas, busqueda).sort(
      (a, b) => (b.ultimoServicio?.getTime() ?? 0) - (a.ultimoServicio?.getTime() ?? 0),
    );
  }

  async expedienteParaComercio(comercioId: string, perroId: string): Promise<ExpedienteMascota> {
    await this.perrosService.asegurarRelacionComercio(perroId, comercioId);
    const perro = await this.buscarPerro(perroId);
    const perroOid = perro._id;
    const comercioOid = aObjectId(comercioId, 'Identificador de comercio');

    const [propietarios, reservas, registros] = await Promise.all([
      this.contactosPorId([String(perro.propietarioId)]),
      this.buscarReservas({ perroId: perroOid, comercioId: comercioOid }),
      this.registrosVisiblesParaComercio(perroId, comercioOid),
    ]);

    return {
      perro: sinPropietario(perro),
      propietario: propietarios.get(String(perro.propietarioId)),
      registros: await this.enriquecerRegistros(registros, comercioId),
      servicios: await this.enriquecerServicios(reservas),
    };
  }

  async crearRegistro(
    autor: AutorRegistro,
    perroId: string,
    dto: CrearRegistroServicioDto,
  ): Promise<RegistroExpediente> {
    await this.perrosService.asegurarRelacionComercio(perroId, autor.comercioId);
    await this.validarCategoria(autor.comercioId, dto.vertical);
    if (dto.reservaId) await this.validarReserva(dto.reservaId, perroId, autor.comercioId);

    const creado = await this.historialModel.create({
      perroId: aObjectId(perroId, 'Identificador de perro'),
      comercioId: aObjectId(autor.comercioId, 'Identificador de comercio'),
      autorId: aObjectId(autor.usuarioId, 'Identificador de usuario'),
      vertical: dto.vertical,
      tipoHistorial: tipoDeHistorial(dto.vertical),
      origen: 'comercio',
      ...camposEditables(dto, dto.vertical),
      reservaId: dto.reservaId ? new Types.ObjectId(dto.reservaId) : undefined,
    });

    const [registro] = await this.enriquecerRegistros([creado.toObject() as HistorialPlano], autor.comercioId);
    return registro;
  }

  async actualizarRegistro(
    comercioId: string,
    perroId: string,
    registroId: string,
    dto: ActualizarRegistroServicioDto,
  ): Promise<RegistroExpediente> {
    const filtro = filtroRegistroPropio(comercioId, perroId, registroId);
    const actual = await this.historialModel.findOne(filtro).select('vertical titulo').lean().exec();
    if (!actual) throw new DomainException('Registro no encontrado', 404);

    const cambios = camposEditables(dto, actual.vertical, actual.titulo ?? '');
    const actualizado = await this.historialModel
      .findOneAndUpdate(filtro, { $set: cambios }, { new: true })
      .lean()
      .exec();
    if (!actualizado) throw new DomainException('Registro no encontrado', 404);

    const [registro] = await this.enriquecerRegistros([actualizado as unknown as HistorialPlano], comercioId);
    return registro;
  }

  async eliminarRegistro(comercioId: string, perroId: string, registroId: string): Promise<void> {
    const resultado = await this.historialModel
      .deleteOne(filtroRegistroPropio(comercioId, perroId, registroId))
      .exec();
    if (!resultado.deletedCount) throw new DomainException('Registro no encontrado', 404);
  }

  /**
   * Informe PDF de la mascota emitido por el comercio: el mismo documento que se
   * descarga el dueño, con el nombre del negocio y el contacto del propietario, y
   * sólo con el historial que este comercio puede ver.
   */
  async informeParaComercio(comercioId: string, perroId: string): Promise<InformeDescargable> {
    const [expediente, emisor] = await Promise.all([
      this.expedienteParaComercio(comercioId, perroId),
      this.nombreComercio(comercioId),
    ]);
    return this.informes.componer({
      perro: expediente.perro as unknown as Perro,
      entradas: expediente.registros.map((r) => ({ ...r, tipoHistorial: r.tipoHistorial as TipoHistorial | undefined })),
      emisor,
      propietario: expediente.propietario,
    });
  }

  async nombreComercio(comercioId: string): Promise<string> {
    const comercio = await this.comercioModel.findById(comercioId).select('nombreComercial').lean().exec();
    return comercio?.nombreComercial ?? 'Doogking';
  }

  // ── Cuenta del propietario ─────────────────────────────────────────────────

  async expedienteParaPropietario(propietarioId: string, perroId: string): Promise<ExpedienteMascota> {
    await this.perrosService.obtenerPropio(perroId, propietarioId);
    const perro = await this.buscarPerro(perroId);

    const [registros, reservas] = await Promise.all([
      this.historialModel.find({ perroId: perro._id }).sort({ createdAt: -1 }).lean().exec() as unknown as Promise<HistorialPlano[]>,
      this.buscarReservas({ perroId: perro._id, estado: { $nin: ESTADOS_SIN_SERVICIO } }),
    ]);

    return {
      perro: sinPropietario(perro),
      registros: await this.enriquecerRegistros(registros),
      servicios: await this.enriquecerServicios(reservas),
    };
  }

  // ── Auxiliares ─────────────────────────────────────────────────────────────

  private agruparReservasPorPerro(comercioId: Types.ObjectId): Promise<GrupoReservasPerro[]> {
    return this.reservaModel
      .aggregate<GrupoReservasPerro>([
        { $match: { comercioId, perroId: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$perroId',
            totalReservas: { $sum: 1 },
            serviciosCompletados: {
              $sum: { $cond: [{ $in: ['$estado', [ReservaEstado.COMPLETADA, ReservaEstado.PAGO_LIBERADO]] }, 1, 0] },
            },
            ultimoServicio: { $max: '$fechaInicio' },
            verticales: { $addToSet: '$vertical' },
          },
        },
      ])
      .exec();
  }

  private async contarRegistros(comercioId: Types.ObjectId, perroIds: Types.ObjectId[]): Promise<Map<string, number>> {
    const conteos = await this.historialModel
      .aggregate<{ _id: Types.ObjectId; total: number }>([
        { $match: { comercioId, perroId: { $in: perroIds } } },
        { $group: { _id: '$perroId', total: { $sum: 1 } } },
      ])
      .exec();
    return new Map(conteos.map((c) => [String(c._id), c.total]));
  }

  private async contactosPorId(ids: string[]): Promise<Map<string, ContactoPropietario>> {
    const usuarios = await this.usersRepo.findContactosByIds([...new Set(ids)]);
    return new Map(
      usuarios.map((u) => [String(u._id), { nombre: u.nombre, email: u.email, telefono: u.telefono }]),
    );
  }

  private async buscarPerro(perroId: string): Promise<PerroPlano> {
    const perro = (await this.perroModel
      .findById(aObjectId(perroId, 'Identificador de perro'))
      .lean()
      .exec()) as unknown as PerroPlano | null;
    if (!perro) throw new DomainException('Perro no encontrado', 404);
    return perro;
  }

  private buscarReservas(filtro: Record<string, unknown>): Promise<ReservaPlana[]> {
    return this.reservaModel
      .find(filtro)
      .select(CAMPOS_RESERVA)
      .sort({ fechaInicio: -1 })
      .limit(200)
      .lean()
      .exec() as unknown as Promise<ReservaPlana[]>;
  }

  /**
   * Lo que escribió el propio comercio, más lo que el dueño comparte con sus
   * categorías (misma regla de consentimientos que el resto de la plataforma).
   */
  private async registrosVisiblesParaComercio(perroId: string, comercioId: Types.ObjectId): Promise<HistorialPlano[]> {
    const comercio = await this.comercioModel.findById(comercioId).select('verticales').lean().exec();
    const [propios, ...compartidos] = await Promise.all([
      this.historialModel.find({ perroId: new Types.ObjectId(perroId), comercioId }).lean().exec(),
      ...(comercio?.verticales ?? []).map((v) => this.perrosService.historialVisiblePara(perroId, v)),
    ]);

    const unicos = new Map<string, HistorialPlano>();
    for (const r of propios as unknown as HistorialPlano[]) unicos.set(String(r._id), r);
    for (const r of compartidos.flat()) {
      const plano = (typeof r.toObject === 'function' ? r.toObject() : r) as HistorialPlano;
      unicos.set(String(plano._id), plano);
    }
    return [...unicos.values()];
  }

  private async enriquecerRegistros(registros: HistorialPlano[], comercioQueConsulta?: string): Promise<RegistroExpediente[]> {
    const nombres = await this.nombresDeComercios(registros.map((r) => r.comercioId));
    return registros
      .map((r) => aRegistro(r, nombres, comercioQueConsulta))
      .sort((a, b) => fechaDeRegistro(b) - fechaDeRegistro(a));
  }

  private async enriquecerServicios(reservas: ReservaPlana[]): Promise<ServicioExpediente[]> {
    if (!reservas.length) return [];
    const [nombres, servicios] = await Promise.all([
      this.nombresDeComercios(reservas.map((r) => r.comercioId)),
      this.servicioModel
        .find({ _id: { $in: [...new Set(reservas.map((r) => String(r.servicioId)))] } })
        .select('titulo')
        .lean()
        .exec() as unknown as Promise<Array<{ _id: Types.ObjectId; titulo?: string }>>,
    ]);
    const titulos = new Map(servicios.map((s) => [String(s._id), s.titulo]));
    return reservas.map((r) => ({
      reservaId: String(r._id),
      codigo: r.codigo,
      vertical: r.vertical,
      servicioTitulo: titulos.get(String(r.servicioId)),
      comercioId: String(r.comercioId),
      comercioNombre: nombres.get(String(r.comercioId)),
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
      estado: r.estado,
    }));
  }

  private async nombresDeComercios(ids: Array<Types.ObjectId | undefined>): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter(Boolean).map(String))];
    if (!unicos.length) return new Map();
    const comercios = await this.comercioModel
      .find({ _id: { $in: unicos } })
      .select('nombreComercial')
      .lean()
      .exec();
    return new Map(comercios.map((c) => [String(c._id), c.nombreComercial]));
  }

  private async validarCategoria(comercioId: string, vertical: VerticalKey): Promise<void> {
    if (!tieneHistorialDeServicio(vertical)) {
      throw new DomainException('Esta categoría no lleva historial de servicios', 400);
    }
    const comercio = await this.comercioModel.findById(comercioId).select('verticales').lean().exec();
    if (!comercio?.verticales?.includes(vertical)) {
      throw new DomainException('Tu negocio no opera en esta categoría', 403);
    }
  }

  private async validarReserva(reservaId: string, perroId: string, comercioId: string): Promise<void> {
    const existe = await this.reservaModel
      .exists({
        _id: aObjectId(reservaId, 'Identificador de reserva'),
        perroId: new Types.ObjectId(perroId),
        comercioId: new Types.ObjectId(comercioId),
      })
      .exec();
    if (!existe) throw new DomainException('La reserva no corresponde a esta mascota', 400);
  }
}

// ── Funciones puras ──────────────────────────────────────────────────────────

function aObjectId(id: string, que: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new DomainException(`${que} no válido`, 400);
  return new Types.ObjectId(id);
}

function tipoDeHistorial(vertical: string): TipoHistorial | undefined {
  const entrada = Object.entries(HISTORIAL_ORIGEN).find(([, origen]) => origen === vertical);
  return entrada?.[0] as TipoHistorial | undefined;
}

/** Sólo el comercio que escribió un registro puede tocarlo. */
function filtroRegistroPropio(comercioId: string, perroId: string, registroId: string) {
  return {
    _id: aObjectId(registroId, 'Identificador de registro'),
    perroId: aObjectId(perroId, 'Identificador de perro'),
    comercioId: aObjectId(comercioId, 'Identificador de comercio'),
    origen: 'comercio',
  };
}

/**
 * Campos que el formulario puede fijar, ya normalizados para Mongo. La nota es
 * obligatoria en el esquema (el historial antiguo sólo tenía nota), así que un
 * registro sin texto libre la hereda del título.
 */
function camposEditables(dto: ActualizarRegistroServicioDto, vertical: string, tituloActual = '') {
  const titulo = dto.titulo?.trim() || tituloActual;
  const cambios: Record<string, unknown> = {};
  if (dto.titulo !== undefined) cambios['titulo'] = titulo;
  if (dto.nota !== undefined || dto.titulo !== undefined) cambios['nota'] = dto.nota?.trim() || titulo;
  if (dto.profesional !== undefined) cambios['profesional'] = dto.profesional.trim() || undefined;
  if (dto.fechaServicio !== undefined) cambios['fechaServicio'] = new Date(dto.fechaServicio);
  if (dto.proximaCita !== undefined) cambios['proximaCita'] = new Date(dto.proximaCita);
  if (dto.datosEstructurados !== undefined) {
    cambios['datosEstructurados'] = limpiarDatosRegistro(vertical, dto.datosEstructurados);
  }
  return cambios;
}

function aRegistro(r: HistorialPlano, nombres: Map<string, string>, comercioQueConsulta?: string): RegistroExpediente {
  const comercioId = r.comercioId ? String(r.comercioId) : undefined;
  return {
    _id: String(r._id),
    vertical: r.vertical,
    tipoHistorial: r.tipoHistorial,
    origen: r.origen ?? 'comercio',
    titulo: r.titulo,
    nota: r.nota,
    datosEstructurados: r.datosEstructurados ?? {},
    fechaServicio: r.fechaServicio,
    profesional: r.profesional,
    proximaCita: r.proximaCita,
    reservaId: r.reservaId ? String(r.reservaId) : undefined,
    comercioId,
    comercioNombre: comercioId ? nombres.get(comercioId) : undefined,
    esPropio: !!comercioQueConsulta && comercioId === comercioQueConsulta && r.origen !== 'propietario',
    createdAt: r.createdAt,
    editadaAt: r.editadaAt,
  };
}

function fechaDeRegistro(r: RegistroExpediente): number {
  return new Date(r.fechaServicio ?? r.createdAt ?? 0).getTime();
}

function sinPropietario(perro: PerroPlano): Record<string, unknown> {
  const { propietarioId: _propietario, ...resto } = perro;
  return { ...resto, _id: String(perro._id) };
}

function aResumen(
  grupo: GrupoReservasPerro,
  perro: PerroPlano,
  propietarios: Map<string, ContactoPropietario>,
  registros: Map<string, number>,
): MascotaComercioResumen {
  const id = String(perro._id);
  return {
    perroId: id,
    nombre: perro.nombre,
    foto: perro.fotos?.[0],
    raza: perro.raza,
    fechaNacimiento: perro.fechaNacimiento,
    sexo: perro.sexo,
    peso: perro.peso,
    tamano: perro.tamano,
    alergias: perro.alergias ?? [],
    enfermedades: perro.enfermedades ?? [],
    tieneMedicacion: (perro.medicacion ?? []).length > 0,
    propietario: propietarios.get(String(perro.propietarioId)) ?? {},
    totalReservas: grupo.totalReservas,
    serviciosCompletados: grupo.serviciosCompletados,
    ultimoServicio: grupo.ultimoServicio,
    verticales: grupo.verticales,
    totalRegistros: registros.get(id) ?? 0,
  };
}

/** Busca por perro, raza o dueño, sin distinguir mayúsculas ni tildes. */
function filtrarPorBusqueda(mascotas: MascotaComercioResumen[], busqueda?: string): MascotaComercioResumen[] {
  const termino = normalizar(busqueda ?? '');
  if (!termino) return mascotas;
  return mascotas.filter((m) =>
    [m.nombre, m.raza, m.propietario.nombre, m.propietario.email, m.propietario.telefono]
      .some((campo) => normalizar(campo ?? '').includes(termino)),
  );
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
