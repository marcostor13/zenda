import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Perro, PerroDocument } from './perro.schema';
import { PerroHistorial, PerroHistorialDocument } from './perro-historial.schema';
import { PerroVersion, PerroVersionDocument } from './perro-version.schema';
import { Consentimiento, ConsentimientoDocument } from './consentimiento.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import {
  CrearPerroDto, ActualizarPerroDto, CrearPerroHistorialDto, FijarConsentimientoDto,
  TamanoPerro, TipoPelo, TipoHistorial, VerticalKey, HISTORIAL_ORIGEN, ReservaEstado,
} from 'shared';

/** Estimación de precio ajustada por el historial de suplementos del perro (Ref. N8). */
export interface EstimacionPrecio {
  precioBase: number;
  precioEstimado: number;
  promedioAjustePct: number;
  basadoEnReservas: number;
}

type CrearPerroData = Omit<CrearPerroDto, 'fechaNacimiento' | 'fechaImplantacionMicrochip'> & {
  fechaNacimiento?: Date;
  fechaImplantacionMicrochip?: Date;
};

/** Vista de solo-salud del perro para la Historia Veterinaria Compartida (docs §5.5). */
export interface HistoriaCompartida {
  nombre: string;
  especie: string;
  raza?: string;
  fechaNacimiento?: Date;
  sexo?: string;
  esterilizado: boolean;
  peso?: number;
  vacunas: string[];
  alergias: string[];
  enfermedades: string[];
  medicacion: string[];
  dieta?: string;
  cartillaSanitariaUrl?: string;
  pasaporteEuropeoUrl?: string;
  certificadosUrl: string[];
  historial: Array<{
    vertical: string;
    nota: string;
    datosEstructurados: Record<string, unknown>;
    createdAt?: Date;
  }>;
}

@Injectable()
export class PerrosService {
  constructor(
    @InjectModel(Perro.name) private readonly perroModel: Model<PerroDocument>,
    @InjectModel(PerroHistorial.name)
    private readonly historialModel: Model<PerroHistorialDocument>,
    @InjectModel(PerroVersion.name)
    private readonly versionModel: Model<PerroVersionDocument>,
    @InjectModel(Reserva.name)
    private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Consentimiento.name)
    private readonly consentimientoModel: Model<ConsentimientoDocument>,
  ) {}

  async crear(propietarioId: string, dto: CrearPerroDto): Promise<PerroDocument> {
    const data: CrearPerroData = {
      ...dto,
      fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : undefined,
      fechaImplantacionMicrochip: dto.fechaImplantacionMicrochip
        ? new Date(dto.fechaImplantacionMicrochip)
        : undefined,
    };

    return this.perroModel.create({ ...data, propietarioId });
  }

  listarPorPropietario(propietarioId: string): Promise<PerroDocument[]> {
    return this.perroModel
      .find({ propietarioId: new Types.ObjectId(propietarioId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async obtenerPropio(id: string, propietarioId: string): Promise<PerroDocument> {
    const perro = await this.perroModel.findById(id).exec();

    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }

    if (perro.propietarioId.toString() !== propietarioId) {
      throw new DomainException('No tienes permiso sobre esta ficha', 403);
    }

    return perro;
  }

  /**
   * Solo los campos de compatibilidad (sin datos sensibles de salud/comportamiento),
   * usados por el filtro de búsqueda del catálogo. No exige propiedad: sirve para
   * que cualquier búsqueda (autenticada o no) pueda filtrar por el perro elegido.
   */
  async obtenerPerfilCompatibilidad(
    id: string,
  ): Promise<{ tamano?: TamanoPerro; tipoPelo?: TipoPelo[]; temperamento?: string } | null> {
    const perro = await this.perroModel
      .findById(id)
      .select('tamano tipoPelo temperamento')
      .lean()
      .exec();

    if (!perro) return null;
    return { tamano: perro.tamano, tipoPelo: perro.tipoPelo, temperamento: perro.temperamento };
  }

  async actualizar(
    id: string,
    propietarioId: string,
    dto: ActualizarPerroDto,
  ): Promise<PerroDocument> {
    const perro = await this.obtenerPropio(id, propietarioId);

    // Se guarda cómo estaba la ficha ANTES del cambio: el precio de una reserva
    // se calcula con los datos declarados, así que ante una disputa hay que
    // poder demostrar qué decía y cuándo cambió (HU-001).
    await this.guardarVersion(perro, propietarioId, dto);

    Object.assign(perro, {
      ...dto,
      fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : perro.fechaNacimiento,
      fechaImplantacionMicrochip: dto.fechaImplantacionMicrochip
        ? new Date(dto.fechaImplantacionMicrochip)
        : perro.fechaImplantacionMicrochip,
    });

    return perro.save();
  }

  /** Historial de cambios de la ficha, del más reciente al más antiguo. */
  async listarVersiones(perroId: string, propietarioId: string): Promise<PerroVersionDocument[]> {
    await this.obtenerPropio(perroId, propietarioId);

    return this.versionModel
      .find({ perroId: new Types.ObjectId(perroId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  private async guardarVersion(
    perro: PerroDocument,
    propietarioId: string,
    dto: ActualizarPerroDto,
  ): Promise<void> {
    const anterior = perro.toObject() as unknown as Record<string, unknown>;

    const campos = Object.keys(dto).filter((campo) => {
      const nuevo = (dto as Record<string, unknown>)[campo];
      if (nuevo === undefined) return false;
      return JSON.stringify(nuevo) !== JSON.stringify(anterior[campo]);
    });

    // Guardar una versión idéntica a la anterior solo ensucia el historial.
    if (!campos.length) return;

    await this.versionModel.create({
      perroId: perro._id,
      cambiadoPor: new Types.ObjectId(propietarioId),
      campos,
      anterior,
    });
  }

  async eliminar(id: string, propietarioId: string): Promise<void> {
    const perro = await this.obtenerPropio(id, propietarioId);
    await perro.deleteOne();
  }

  /**
   * Historia Veterinaria Compartida (docs/mejora_servicios.md §5.5): con autorización del
   * propietario, cualquier profesional de la plataforma puede consultar el historial de
   * salud del perro antes de una consulta, sin exigir propiedad de la ficha (a diferencia
   * de `obtenerPropio`). Si el propietario no autorizó compartir, se rechaza.
   */
  async obtenerHistoriaCompartida(perroId: string): Promise<HistoriaCompartida> {
    const perro = await this.perroModel
      .findById(perroId)
      .select('nombre especie raza fechaNacimiento sexo esterilizado peso vacunas alergias enfermedades medicacion dieta cartillaSanitariaUrl pasaporteEuropeoUrl certificadosUrl autorizaCompartirHistorial')
      .lean()
      .exec();

    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }
    if (!perro.autorizaCompartirHistorial) {
      throw new DomainException('El propietario no autorizó compartir el historial de este perro', 403);
    }

    const historial = await this.historialModel
      .find({ perroId: new Types.ObjectId(perroId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return {
      nombre: perro.nombre,
      especie: perro.especie,
      raza: perro.raza,
      fechaNacimiento: perro.fechaNacimiento,
      sexo: perro.sexo,
      esterilizado: perro.esterilizado,
      peso: perro.peso,
      vacunas: perro.vacunas,
      alergias: perro.alergias,
      enfermedades: perro.enfermedades,
      medicacion: perro.medicacion,
      dieta: perro.dieta,
      cartillaSanitariaUrl: perro.cartillaSanitariaUrl,
      pasaporteEuropeoUrl: perro.pasaporteEuropeoUrl,
      certificadosUrl: perro.certificadosUrl,
      historial,
    };
  }

  async agregarHistorial(
    perroId: string,
    comercioId: string,
    dto: CrearPerroHistorialDto,
  ): Promise<PerroHistorialDocument> {
    const perro = await this.perroModel.findById(perroId).exec();

    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }

    return this.historialModel.create({ ...dto, perroId, comercioId });
  }

  async listarHistorial(perroId: string, propietarioId: string): Promise<PerroHistorialDocument[]> {
    await this.obtenerPropio(perroId, propietarioId);

    return this.historialModel
      .find({ perroId: new Types.ObjectId(perroId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Historial que un vertical concreto puede leer (HU-016).
   *
   * Regla por defecto: **cada vertical ve solo lo que él mismo generó**. Para
   * ver lo de otro hace falta un consentimiento explícito y vigente del
   * propietario. Es opt-in: la ausencia de consentimiento nunca autoriza.
   */
  async historialVisiblePara(
    perroId: string,
    verticalDestino: VerticalKey,
  ): Promise<PerroHistorialDocument[]> {
    const consentimientos = await this.consentimientoModel
      .find({ perroId: new Types.ObjectId(perroId), verticalDestino, concedido: true })
      .lean()
      .exec();

    const autorizados = new Set(consentimientos.map((c) => c.tipoHistorial as string));

    const propios = Object.entries(HISTORIAL_ORIGEN)
      .filter(([, origen]) => origen === verticalDestino)
      .map(([tipo]) => tipo);
    for (const tipo of propios) autorizados.add(tipo);

    if (!autorizados.size) return [];

    return this.historialModel
      .find({
        perroId: new Types.ObjectId(perroId),
        $or: [
          { tipoHistorial: { $in: [...autorizados] } },
          // Entradas antiguas sin `tipoHistorial`: se deducen por su vertical,
          // que es de donde salieron.
          { tipoHistorial: { $exists: false }, vertical: verticalDestino },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Matriz de consentimientos del perro: qué ve cada vertical de cada historial. */
  async listarConsentimientos(
    perroId: string,
    propietarioId: string,
  ): Promise<ConsentimientoDocument[]> {
    await this.obtenerPropio(perroId, propietarioId);

    return this.consentimientoModel.find({ perroId: new Types.ObjectId(perroId) }).exec();
  }

  /** Concede o revoca el acceso de un vertical a un tipo de historial. */
  async fijarConsentimiento(
    perroId: string,
    propietarioId: string,
    dto: FijarConsentimientoDto,
  ): Promise<ConsentimientoDocument> {
    await this.obtenerPropio(perroId, propietarioId);
    const ahora = new Date();

    const actualizado = await this.consentimientoModel
      .findOneAndUpdate(
        {
          perroId: new Types.ObjectId(perroId),
          tipoHistorial: dto.tipoHistorial,
          verticalDestino: dto.verticalDestino,
        },
        {
          $set: {
            propietarioId: new Types.ObjectId(propietarioId),
            concedido: dto.concedido,
            ...(dto.concedido ? { fechaConcesion: ahora } : { fechaRevocacion: ahora }),
          },
        },
        { new: true, upsert: true },
      )
      .exec();

    return actualizado;
  }

  /** Revoca de golpe todos los consentimientos de la ficha. */
  async revocarTodosLosConsentimientos(perroId: string, propietarioId: string): Promise<number> {
    await this.obtenerPropio(perroId, propietarioId);

    const resultado = await this.consentimientoModel
      .updateMany(
        { perroId: new Types.ObjectId(perroId), concedido: true },
        { $set: { concedido: false, fechaRevocacion: new Date() } },
      )
      .exec();

    return resultado.modifiedCount;
  }

  /**
   * El propietario corrige una entrada que escribió una empresa (HU-015). Los
   * datos de su mascota son suyos: puede modificarlos.
   */
  async editarHistorial(
    perroId: string,
    historialId: string,
    propietarioId: string,
    nota: string,
  ): Promise<PerroHistorialDocument> {
    await this.obtenerPropio(perroId, propietarioId);

    const entrada = await this.historialModel
      .findOneAndUpdate(
        {
          _id: aObjectId(historialId, 'Identificador de entrada'),
          perroId: aObjectId(perroId, 'Identificador de perro'),
        },
        { $set: { nota, editadaAt: new Date() } },
        { new: true },
      )
      .exec();

    if (!entrada) {
      throw new DomainException('Entrada de historial no encontrada', 404);
    }
    return entrada;
  }

  /** El propietario elimina una entrada del historial de su mascota (HU-015). */
  async eliminarHistorial(
    perroId: string,
    historialId: string,
    propietarioId: string,
  ): Promise<void> {
    await this.obtenerPropio(perroId, propietarioId);

    const resultado = await this.historialModel
      .deleteOne({
        _id: aObjectId(historialId, 'Identificador de entrada'),
        perroId: aObjectId(perroId, 'Identificador de perro'),
      })
      .exec();

    if (!resultado.deletedCount) {
      throw new DomainException('Entrada de historial no encontrada', 404);
    }
  }

  /**
   * Importación por copiar y pegar desde Excel o un documento (HU-032). El
   * profesional pega y ve la tabla resultante **antes** de confirmar: nada se
   * guarda a ciegas.
   */
  parsearImportacion(texto: string): Array<{ fecha?: string; concepto: string; detalle?: string }> {
    return texto
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter(Boolean)
      .map((linea) => {
        const columnas = linea.split('\t').map((c) => c.trim());

        // Pegado desde texto plano: toda la línea es el concepto.
        if (columnas.length === 1) return { concepto: columnas[0] };

        const [primera, ...resto] = columnas;
        // Si la primera columna es una fecha, se separa; si no, es concepto.
        return esFecha(primera)
          ? { fecha: primera, concepto: resto[0] ?? '', detalle: resto.slice(1).join(' · ') || undefined }
          : { concepto: primera, detalle: resto.join(' · ') || undefined };
      })
      .filter((fila) => Boolean(fila.concepto));
  }

  /** Guarda de golpe las filas que el profesional ya ha revisado. */
  async importarHistorial(
    perroId: string,
    comercioId: string,
    vertical: VerticalKey,
    filas: Array<{ fecha?: string; concepto: string; detalle?: string }>,
  ): Promise<number> {
    const perro = await this.perroModel.findById(perroId).exec();
    if (!perro) {
      throw new DomainException('Perro no encontrado', 404);
    }
    if (!filas.length) {
      throw new DomainException('No hay nada que importar', 400);
    }

    await this.historialModel.insertMany(
      filas.map((fila) => ({
        perroId: new Types.ObjectId(perroId),
        comercioId: new Types.ObjectId(comercioId),
        vertical,
        tipoHistorial: TIPO_POR_VERTICAL[vertical],
        origen: 'comercio',
        nota: [fila.fecha, fila.concepto, fila.detalle].filter(Boolean).join(' — '),
        datosEstructurados: { ...fila, importado: true },
      })),
    );

    return filas.length;
  }

  /**
   * Presupuesto ajustado por el historial del perro (Ref. N8): usa el porcentaje medio
   * de ajuste de precio (suplementos aceptados) de sus reservas anteriores para dar una
   * estimación más realista que el precio base — no toca el cálculo real, que sigue
   * haciendo la estrategia de disponibilidad del vertical al reservar.
   */
  async estimarPrecioConHistorial(perroId: string, precioBase: number): Promise<EstimacionPrecio> {
    const reservas = await this.reservaModel
      .find({
        perroId: aObjectId(perroId, 'Identificador de perro'),
        estado: { $in: [ReservaEstado.CONFIRMADA, ReservaEstado.COMPLETADA] },
        montoSubtotal: { $gt: 0 },
      })
      .select('montoSubtotal suplementos')
      .lean()
      .exec();

    if (!reservas.length) {
      return { precioBase, precioEstimado: precioBase, promedioAjustePct: 0, basadoEnReservas: 0 };
    }

    const ratios = reservas.map((r) => {
      const totalSuplementos = (r.suplementos ?? []).reduce((suma, s) => suma + s.monto, 0);
      return totalSuplementos / r.montoSubtotal;
    });
    const promedioRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

    return {
      precioBase,
      precioEstimado: Math.round(precioBase * (1 + promedioRatio) * 100) / 100,
      promedioAjustePct: Math.round(promedioRatio * 1000) / 10,
      basadoEnReservas: reservas.length,
    };
  }
}

/**
 * Convierte a ObjectId validando antes. Sin esta comprobación, un id malformado
 * en la URL revienta con un `BSONError` y el cliente recibe un 500 en vez de un
 * error claro.
 */
function aObjectId(id: string, que: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new DomainException(`${que} no válido`, 400);
  }
  return new Types.ObjectId(id);
}

/** Detecta formatos de fecha habituales al pegar desde Excel. */
function esFecha(valor: string): boolean {
  return /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/.test(valor);
}

/** Tipo de historial que genera cada vertical. */
const TIPO_POR_VERTICAL: Partial<Record<VerticalKey, TipoHistorial>> = Object.fromEntries(
  Object.entries(HISTORIAL_ORIGEN).map(([tipo, vertical]) => [vertical, tipo as TipoHistorial]),
) as Partial<Record<VerticalKey, TipoHistorial>>;
