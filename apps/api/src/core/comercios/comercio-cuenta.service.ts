import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import {
  EntidadAuditada,
  EstadoComercio,
  ImpactoBajaComercioDto,
  MotivoBajaComercio,
  OrigenBajaComercio,
  PausarComercioDto,
  ResultadoBajaComercioDto,
  ReservaEstado,
  Rol,
  etiquetaMotivoBaja,
} from 'shared';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { BajaComercio, ComercioDocument } from './comercio.schema';
import { ComerciosRepository } from './comercios.repository';

/**
 * Reservas que impiden desaparecer: hay un cliente esperando el servicio o
 * dinero retenido. Una cuenta no puede irse dejandolas colgadas.
 */
const ESTADOS_RESERVA_VIVOS: ReadonlyArray<string> = [
  ReservaEstado.PENDIENTE,
  ReservaEstado.CONFIRMADA,
  ReservaEstado.AJUSTE_SOLICITADO,
  ReservaEstado.EN_CURSO,
  ReservaEstado.PAGO_RETENIDO,
  ReservaEstado.EN_DISPUTA,
];

/**
 * Ventana en la que una baja lógica se puede deshacer. Cubre el arrepentimiento
 * y los errores de operación; pasada, la cuenta es candidata a purga.
 */
export const DIAS_GRACIA_BAJA_COMERCIO = 30;

/** Cuentas del equipo de un comercio (no clientes que además tengan reservas). */
const ROLES_DE_COMERCIO: ReadonlyArray<string> = [Rol.COMERCIO_ADMIN, Rol.COMERCIO_STAFF];

/** Colecciones cuyo documento cuelga directamente de un `comercioId`. */
const COLECCIONES_DEL_COMERCIO: ReadonlyArray<string> = [
  'reservas',
  'servicios',
  'resenas',
  'liquidaciones',
  'cupones',
  'agendas',
  'suplemento_configs',
  'solicitudes_valoracion',
  'incidencias',
];

export interface DarDeBajaParams {
  readonly motivo: MotivoBajaComercio;
  readonly comentario?: string;
  readonly origen: OrigenBajaComercio;
  readonly actorId?: string;
  readonly aceptaContacto?: boolean;
  /** Borrado físico e irreversible. Reservado al admin. */
  readonly purgar?: boolean;
}

/**
 * Ciclo de vida de la cuenta de un comercio: standby, reactivación, baja y
 * purga, con la cascada sobre todo lo que cuelga del negocio.
 *
 * Vive aparte de `ComerciosService` porque su responsabilidad es distinta —ese
 * gestiona la operativa diaria, este el alta y baja de la cuenta— y porque la
 * cascada toca colecciones de media docena de módulos: inyectar sus modelos uno
 * a uno crearía un ciclo de dependencias entre casi todo el core, así que se
 * trabaja sobre la conexión de Mongo.
 */
@Injectable()
export class ComercioCuentaService {
  private readonly logger = new Logger(ComercioCuentaService.name);

  constructor(
    @InjectConnection() private readonly conexion: Connection,
    private readonly repo: ComerciosRepository,
    private readonly auditoria: AuditoriaService,
  ) {}

  // -- Consulta previa --------------------------------------------------------

  /** Qué se lleva por delante la baja. Se enseña ANTES de pedir confirmación. */
  async impacto(comercioId: string): Promise<ImpactoBajaComercioDto> {
    const comercio = await this.obtenerVivo(comercioId);
    const id = comercio._id as Types.ObjectId;

    const [servicios, serviciosPublicados, usuarios, reservas, reservasActivas, resenas] =
      await Promise.all([
        this.coleccion('servicios').countDocuments({ comercioId: id }),
        this.coleccion('servicios').countDocuments({ comercioId: id, estado: 'publicado' }),
        this.coleccion('usuarios').countDocuments({ comercioId: id }),
        this.coleccion('reservas').countDocuments({ comercioId: id }),
        this.coleccion('reservas').countDocuments({
          comercioId: id,
          estado: { $in: ESTADOS_RESERVA_VIVOS },
        }),
        this.coleccion('resenas').countDocuments({ comercioId: id }),
      ]);

    return {
      servicios,
      serviciosPublicados,
      usuarios,
      reservas,
      reservasActivas,
      resenas,
      puedeDarseDeBaja: reservasActivas === 0,
    };
  }

  // -- Standby ----------------------------------------------------------------

  /**
   * Pausa la cuenta: desaparece del buscador y deja de aceptar reservas, pero
   * conserva listados, equipo e historial. Es reversible desde el propio panel.
   */
  async pausar(
    comercioId: string,
    dto: PausarComercioDto,
    actorId?: string,
    origen: OrigenBajaComercio = 'comercio',
  ): Promise<ComercioDocument> {
    const comercio = await this.obtenerVivo(comercioId);
    if (comercio.estado === 'suspendido') {
      throw new DomainException(
        'La cuenta está suspendida por la plataforma; contacta con soporte para reactivarla',
        409,
      );
    }

    const baja: BajaComercio = {
      motivo: dto.motivo,
      comentario: dto.comentario?.trim() || undefined,
      fecha: new Date(),
      origen,
      actorId,
      estadoPrevio: comercio.estado,
      reactivarEl: dto.reactivarEl,
    };

    const actualizado = await this.repo.actualizarCampos(comercioId, { estado: 'inactivo', baja });
    await this.sincronizarVisibilidad(comercio._id as Types.ObjectId, false);
    await this.registrar(actorId, comercioId, `${comercio.nombreComercial} pausó su cuenta`, {
      motivo: etiquetaMotivoBaja(dto.motivo),
      antes: comercio.estado,
      despues: 'inactivo',
    });

    return actualizado ?? comercio;
  }

  /**
   * Vuelve a poner la cuenta en marcha. Solo sirve para el standby voluntario:
   * una suspensión del admin no se levanta desde el panel del comercio.
   */
  async reactivar(comercioId: string, actorId?: string): Promise<ComercioDocument> {
    const comercio = await this.obtenerVivo(comercioId);
    if (comercio.estado === 'activo') return comercio;
    if (comercio.estado !== 'inactivo') {
      throw new DomainException(
        'Solo se puede reactivar una cuenta en pausa; escribe a soporte para revisar su estado',
        409,
      );
    }

    const actualizado = await this.repo.actualizarCampos(comercioId, { estado: 'activo' });
    await this.sincronizarVisibilidad(comercio._id as Types.ObjectId, true);
    await this.registrar(actorId, comercioId, `${comercio.nombreComercial} reactivó su cuenta`, {
      antes: 'inactivo',
      despues: 'activo',
    });

    return actualizado ?? comercio;
  }

  // -- Baja -------------------------------------------------------------------

  /**
   * Da de baja la cuenta. Por defecto es **lógica**: el comercio pasa a
   * `eliminado`, sus listados se despublican y su equipo pierde el acceso, pero
   * reservas, pagos y liquidaciones siguen ahí porque la ley obliga a
   * conservarlos y los informes financieros los necesitan.
   *
   * Con `purgar` el borrado es físico y arrastra reservas y pagos: existe para
   * limpiar datos de prueba, no para el uso corriente.
   */
  async darDeBaja(comercioId: string, params: DarDeBajaParams): Promise<ResultadoBajaComercioDto> {
    const comercio = await this.obtenerVivo(comercioId);
    const id = comercio._id as Types.ObjectId;
    const impacto = await this.impacto(comercioId);

    if (!impacto.puedeDarseDeBaja) {
      throw new DomainException(
        `No se puede dar de baja: hay ${impacto.reservasActivas} reserva(s) en curso. ` +
          'Complétalas o cancélalas antes de cerrar la cuenta.',
        409,
      );
    }

    const usuariosAfectados = params.purgar
      ? await this.purgar(id)
      : await this.bajaLogica(comercio, params);

    await this.registrar(
      params.actorId,
      comercioId,
      params.purgar
        ? `${comercio.nombreComercial} eliminado definitivamente`
        : `${comercio.nombreComercial} dado de baja (${params.origen})`,
      {
        motivo: etiquetaMotivoBaja(params.motivo),
        antes: comercio.estado,
        despues: params.purgar ? 'purgado' : 'eliminado',
      },
    );

    return {
      comercioId,
      nombreComercial: comercio.nombreComercial,
      purgado: !!params.purgar,
      serviciosAfectados: impacto.servicios,
      usuariosAfectados,
      reservasConservadas: params.purgar ? 0 : impacto.reservas,
      origen: params.origen,
      restaurableHasta: params.purgar
        ? undefined
        : new Date(Date.now() + DIAS_GRACIA_BAJA_COMERCIO * 86_400_000).toISOString(),
    };
  }

  /**
   * Deshace una baja lógica dentro del periodo de gracia. La cuenta vuelve en
   * pausa, nunca directamente publicada: quien la restaura debe revisarla antes
   * de que sus listados reaparezcan en el buscador.
   */
  async restaurar(comercioId: string, adminId?: string): Promise<ComercioDocument> {
    const comercio = await this.repo.findById(comercioId);
    if (!comercio) throw new DomainException('Comercio no encontrado', 404);
    if (comercio.estado !== 'eliminado') {
      throw new DomainException('El comercio no está dado de baja', 409);
    }

    const actualizado = await this.repo.actualizarCampos(comercioId, {
      estado: 'inactivo',
      eliminadoAt: undefined,
    });
    await this.coleccion('usuarios').updateMany(
      { comercioId: comercio._id as Types.ObjectId, rol: { $in: ROLES_DE_COMERCIO } },
      { $set: { activo: true } },
    );
    await this.registrar(adminId, comercioId, `${comercio.nombreComercial} restaurado tras su baja`, {
      antes: 'eliminado',
      despues: 'inactivo',
    });

    return actualizado ?? comercio;
  }

  // -- Interno ----------------------------------------------------------------

  /**
   * Baja lógica con su cascada. Despublicar los listados **además** de bajar el
   * flag es intencional: `comercioActivo` solo lo mira el buscador, y sin
   * despublicar el servicio seguía siendo alcanzable por enlace directo.
   */
  private async bajaLogica(comercio: ComercioDocument, params: DarDeBajaParams): Promise<number> {
    const id = comercio._id as Types.ObjectId;
    const baja: BajaComercio = {
      motivo: params.motivo,
      comentario: params.comentario?.trim() || undefined,
      fecha: new Date(),
      origen: params.origen,
      actorId: params.actorId,
      estadoPrevio: comercio.estado,
      aceptaContacto: params.aceptaContacto,
    };

    await this.repo.actualizarCampos(String(id), {
      estado: 'eliminado' as EstadoComercio,
      eliminadoAt: new Date(),
      baja,
    });

    await this.coleccion('servicios').updateMany(
      { comercioId: id },
      { $set: { comercioActivo: false, estado: 'pausado' } },
    );

    // Las cuentas del equipo pierden el acceso pero se conservan: borrarlas
    // dejaría sin autor las reservas que atendieron y las respuestas a reseñas.
    const usuarios = await this.coleccion('usuarios').updateMany(
      { comercioId: id, rol: { $in: ROLES_DE_COMERCIO } },
      { $set: { activo: false } },
    );

    // Un cupón de un comercio que ya no opera no puede seguir canjeándose.
    await this.coleccion('cupones').updateMany({ comercioId: id }, { $set: { activo: false } });

    return usuarios.modifiedCount ?? 0;
  }

  /**
   * Borrado físico en cascada. Solo para datos de prueba: se lleva por delante
   * el histórico contable del comercio, que en producción hay que conservar.
   */
  private async purgar(id: Types.ObjectId): Promise<number> {
    const servicioIds = await this.idsDe('servicios', { comercioId: id });
    const reservaIds = await this.idsDe('reservas', { comercioId: id });

    if (reservaIds.length) {
      await this.coleccion('pagos').deleteMany({ reservaId: { $in: reservaIds } });
      await this.coleccion('incidencias').deleteMany({ reservaId: { $in: reservaIds } });
    }
    if (servicioIds.length) {
      await this.coleccion('favoritos').deleteMany({ servicioId: { $in: servicioIds } });
      await this.coleccion('lista_espera').deleteMany({ servicioId: { $in: servicioIds } });
      await this.coleccion('bloqueos').deleteMany({ servicioId: { $in: servicioIds } });
    }

    for (const nombre of COLECCIONES_DEL_COMERCIO) {
      await this.coleccion(nombre).deleteMany({ comercioId: id });
    }
    // El carrito guarda el comercio dentro de cada línea, no en la raíz: se
    // quitan sólo esas líneas para no vaciarle el carrito a nadie más.
    await this.coleccion('carritos').updateMany(
      { 'items.comercioId': id },
      { $pull: { items: { comercioId: id } } } as unknown as Record<string, unknown>,
    );

    const usuarios = await this.coleccion('usuarios').deleteMany({
      comercioId: id,
      rol: { $in: ROLES_DE_COMERCIO },
    });
    // Un cliente que además era staff conserva su cuenta, pero sin el vínculo.
    await this.coleccion('usuarios').updateMany({ comercioId: id }, { $unset: { comercioId: '' } });

    await this.repo.eliminar(String(id));
    this.logger.log(`Comercio ${String(id)} purgado: ${servicioIds.length} servicios, ${reservaIds.length} reservas`);
    return usuarios.deletedCount ?? 0;
  }

  private async idsDe(coleccion: string, filtro: Record<string, unknown>): Promise<Types.ObjectId[]> {
    const docs = await this.coleccion(coleccion).find(filtro, { projection: { _id: 1 } }).toArray();
    return docs.map((d) => d['_id'] as Types.ObjectId);
  }

  /**
   * El buscador filtra por el flag denormalizado del listado, no por el estado
   * del comercio: sin propagarlo, pausar la cuenta la dejaba igual de visible.
   */
  private async sincronizarVisibilidad(id: Types.ObjectId, activo: boolean): Promise<void> {
    await this.coleccion('servicios').updateMany(
      { comercioId: id },
      { $set: { comercioActivo: activo } },
    );
  }

  private async obtenerVivo(comercioId: string): Promise<ComercioDocument> {
    const comercio = await this.repo.findById(comercioId);
    if (!comercio || comercio.estado === 'eliminado') {
      throw new DomainException('Comercio no encontrado', 404);
    }
    return comercio;
  }

  private coleccion(nombre: string) {
    return this.conexion.collection(nombre);
  }

  private async registrar(
    actorId: string | undefined,
    comercioId: string,
    descripcion: string,
    datos: { motivo?: string; antes?: string; despues?: string },
  ): Promise<void> {
    if (!actorId) return;
    await this.auditoria.registrar({
      actorId,
      entidad: EntidadAuditada.COMERCIO,
      entidadId: comercioId,
      descripcion,
      motivo: datos.motivo,
      antes: datos.antes ? { estado: datos.antes } : undefined,
      despues: datos.despues ? { estado: datos.despues } : undefined,
    });
  }
}
