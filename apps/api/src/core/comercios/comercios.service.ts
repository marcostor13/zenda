import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ComerciosRepository } from './comercios.repository';
import { ComercioDocument, EstadoComercio, Consentimiento, ConsentimientosComercio } from './comercio.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { EntidadAuditada, FijarSocioFundadorDto, PagoEstado, ReservaEstado } from 'shared';

/** Compromiso estándar del programa Socios Fundadores. */
const MESES_CONGELACION_POR_DEFECTO = 24;

/** Reserva tal y como la consume el panel del comercio (TCK-8018). */
export interface ReservaComercioDto extends Reserva {
  _id: Types.ObjectId;
  clienteNombre?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  servicioTitulo?: string;
  perroNombre?: string;
}
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService, ServicioCardDto } from '../catalog/catalog.service';
import { AuthService } from '../auth/auth.service';
import { UsersRepository } from '../users/users.repository';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioDocument } from '../users/usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { RegistrarComercioDto, RegistroComercioDto, ActualizarDisponibilidadDto, AuthResponseDto, RegistroPendienteDto, Rol, ActualizarPerfilComercioDto, ConsentimientosComercioDto, CONDICIONES_COMERCIO_VERSION, SolicitarAjusteDto } from 'shared';
import { campoContador, plazasDeclaradas, sinPlazas } from '../catalog/disponibilidad';

@Injectable()
export class ComerciosService {
  constructor(
    private readonly repo: ComerciosRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    private readonly reviewsService: ReviewsService,
    private readonly bookingsService: BookingsService,
    private readonly catalogService: CatalogService,
    private readonly authService: AuthService,
    private readonly usersRepo: UsersRepository,
    private readonly auditoria: AuditoriaService,
  ) {}

  async registrar(dto: RegistrarComercioDto): Promise<ComercioDocument> {
    const existente = await this.repo.findByVatNumber(dto.vatNumber);
    if (existente) {
      throw new DomainException('Ya existe un comercio con ese identificador fiscal', 409);
    }

    return this.repo.crear({
      razonSocial: dto.razonSocial,
      vatNumber: dto.vatNumber,
      nombreComercial: dto.nombreComercial,
      verticales: dto.verticales,
    });
  }

  /**
   * Alta de comercio en un solo paso (self-service, "Hazte partner"): crea el
   * negocio y la cuenta comercio_admin que lo gestiona. La cuenta queda
   * pendiente de verificar el email antes de poder entrar al panel.
   */
  async registrarConCuenta(dto: RegistroComercioDto): Promise<RegistroPendienteDto> {
    if (await this.usersRepo.findByEmail(dto.email)) {
      throw new DomainException('El email ya está registrado', 409);
    }
    // El CIF es opcional en el alta (perfilado progresivo): solo se valida su
    // unicidad cuando el comercio lo aporta ya en el registro.
    if (dto.vatNumber && (await this.repo.findByVatNumber(dto.vatNumber))) {
      throw new DomainException('Ya existe un comercio con ese identificador fiscal', 409);
    }

    // El alta rápida sólo pide los datos de acceso: el negocio se nombra en el
    // alta guiada. `nombreComercial` es obligatorio en el documento, así que
    // hasta entonces lleva un provisional con el nombre de quien lo crea —el
    // comercio lo ve y lo cambia en el mismo paso en que aporta sus datos.
    const nombreComercial = dto.nombreComercial?.trim() || `Negocio de ${dto.nombre}`;

    const comercio = await this.repo.crear({
      // Sin razón social todavía, se usa el nombre comercial como identidad legal provisional.
      razonSocial: dto.razonSocial || nombreComercial,
      vatNumber: dto.vatNumber || undefined,
      nombreComercial,
      verticales: dto.verticales,
    });

    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const usuario = await this.usersRepo.crear({
        nombre: dto.nombre,
        email: dto.email,
        passwordHash,
        telefono: dto.telefono,
        rol: Rol.COMERCIO_ADMIN,
        comercioId: comercio.id,
        proveedores: ['local'],
      });
      await this.authService.iniciarVerificacionEmail(usuario);
      return { requiereVerificacion: true, email: usuario.email };
    } catch (error) {
      // El comercio no debe quedar huérfano si la creación del usuario falla.
      await this.repo.eliminar(comercio.id);
      if ((error as { code?: number })?.code === 11000) {
        throw new DomainException('Ya existe una cuenta o comercio con esos datos.', 409);
      }
      throw error;
    }
  }

  async obtener(id: string): Promise<ComercioDocument> {
    const comercio = await this.repo.findById(id);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }
    return comercio;
  }

  /**
   * Onboarding self-service: una cuenta con rol de comercio pero SIN comercioId
   * (cuenta huérfana) crea su negocio y queda vinculada, devolviendo un token
   * fresco que ya incluye el comercioId.
   */
  async vincularNuevoComercio(usuarioId: string, dto: RegistrarComercioDto): Promise<AuthResponseDto> {
    const usuario = await this.usersRepo.findById(usuarioId);
    if (!usuario) throw new DomainException('Usuario no encontrado', 404);
    if (usuario.comercioId) {
      throw new DomainException('Tu cuenta ya está vinculada a un comercio', 409);
    }
    if (await this.repo.findByVatNumber(dto.vatNumber)) {
      throw new DomainException('Ya existe un comercio con ese identificador fiscal', 409);
    }

    const comercio = await this.repo.crear({
      razonSocial: dto.razonSocial,
      vatNumber: dto.vatNumber,
      nombreComercial: dto.nombreComercial,
      verticales: dto.verticales,
    });

    const actualizado = await this.usersRepo.actualizarAdmin(usuarioId, { comercioId: comercio.id });
    if (!actualizado) {
      await this.repo.eliminar(comercio.id);
      throw new DomainException('No se pudo vincular el comercio a tu cuenta', 500);
    }
    return this.authService.emitirTokenParaUsuario(actualizado);
  }

  async listar(estado?: EstadoComercio): Promise<ComercioDocument[]> {
    return this.repo.listar(estado ? { estado } : {});
  }

  /**
   * Aprueba, deja pendiente o suspende un comercio. Suspender sin motivo deja al
   * negocio sin saber qué ha pasado y a la plataforma sin poder justificarlo, así
   * que aquí es obligatorio (TCK-8034).
   */
  async cambiarEstado(id: string, estado: EstadoComercio, motivo?: string, adminId?: string): Promise<ComercioDocument> {
    // La baja pasa por `ComercioCuentaService`: arrastra listados y cuentas.
    if (estado === 'eliminado') {
      throw new DomainException('La baja de un comercio no se fija cambiando su estado', 400);
    }
    if (estado === 'suspendido' && !motivo?.trim()) {
      throw new DomainException('Para suspender o rechazar un comercio hay que indicar el motivo', 400);
    }

    const previo = await this.repo.findById(id);
    const comercio = await this.repo.actualizarEstado(id, estado);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }

    // El buscador filtra por el flag denormalizado del listado, no consulta el
    // comercio: sin propagarlo, suspender un negocio lo dejaba igual de visible
    // y de reservable (ver `Servicio.comercioActivo`).
    await this.servicioModel.updateMany(
      { comercioId: comercio._id },
      { comercioActivo: estado === 'activo' },
    ).exec();

    if (adminId) {
      await this.auditoria.registrar({
        actorId: adminId,
        entidad: EntidadAuditada.COMERCIO,
        entidadId: id,
        descripcion: `${comercio.nombreComercial} pasó a estado ${estado}`,
        motivo,
        antes: { estado: previo?.estado },
        despues: { estado },
      });
    }

    return comercio;
  }

  /**
   * Alta o baja en Socios Fundadores (HU-047).
   *
   * Al dar de alta se guarda la comisión congelada y su fecha de caducidad; al
   * dar de baja se limpian ambas, para que el resolver vuelva a la tarifa
   * vigente sin que quede un valor huérfano que pudiera reactivarse por error.
   */
  async fijarSocioFundador(id: string, dto: FijarSocioFundadorDto): Promise<ComercioDocument> {
    const comercio = await this.repo.findById(id);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }

    if (!dto.socioFundador) {
      return this.exigirActualizado(await this.repo.actualizarCampos(id, {
        socioFundador: false,
        comisionPctCongelada: undefined,
        congelacionHasta: undefined,
      }));
    }

    if (dto.comisionPctCongelada == null) {
      throw new DomainException(
        'Indica la comisión que se congela para este socio fundador.',
        400,
      );
    }

    const meses = dto.mesesCongelacion ?? MESES_CONGELACION_POR_DEFECTO;
    const congelacionHasta = new Date();
    congelacionHasta.setMonth(congelacionHasta.getMonth() + meses);

    return this.exigirActualizado(await this.repo.actualizarCampos(id, {
      socioFundador: true,
      comisionPctCongelada: dto.comisionPctCongelada,
      congelacionHasta,
      cohorte: dto.cohorte ?? this.cohorteActual(),
    }));
  }

  /**
   * Alta o baja del comercio en el programa Doogking Alpha (HU-13.3). Es un
   * simple interruptor: las ventajas concretas las define la escalera de niveles
   * del admin, no el comercio.
   */
  async fijarAlphaAdherido(id: string, alphaAdherido: boolean): Promise<ComercioDocument> {
    const comercio = await this.repo.findById(id);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }
    return this.exigirActualizado(await this.repo.actualizarCampos(id, { alphaAdherido }));
  }

  private exigirActualizado(comercio: ComercioDocument | null): ComercioDocument {
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }
    return comercio;
  }

  /** Cohorte por trimestre: `2026-Q3`. Es la dimensión que pide el reporte. */
  private cohorteActual(): string {
    const ahora = new Date();
    return `${ahora.getFullYear()}-Q${Math.floor(ahora.getMonth() / 3) + 1}`;
  }

  private exigirComercio(comercioId: string): void {
    if (!comercioId) {
      throw new DomainException('Tu cuenta no está vinculada a ningún comercio.', 403);
    }
  }

  /**
   * Reservas del comercio con el contexto que necesita quien las gestiona a
   * diario: quién reserva, qué servicio y qué mascota (TCK-8018). El panel
   * busca y filtra sobre estos campos, así que se resuelven aquí en tres
   * consultas por lote y no una por fila.
   */
  async obtenerReservasComercio(
    comercioId: string,
    limite = 20,
  ): Promise<ReservaComercioDto[]> {
    this.exigirComercio(comercioId);
    const reservas = (await this.reservaModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ createdAt: -1 })
      .limit(limite)
      .lean()
      .exec()) as unknown as Array<Reserva & { _id: Types.ObjectId }>;

    if (!reservas.length) return [];

    const [clientes, servicios] = await Promise.all([
      this.usersRepo.findContactosByIds([...new Set(reservas.map((r) => String(r.usuarioId)))]),
      this.servicioModel
        .find({ _id: { $in: [...new Set(reservas.map((r) => String(r.servicioId)))] } })
        .select('titulo')
        .lean()
        .exec() as unknown as Array<{ _id: Types.ObjectId; titulo?: string }>,
    ]);

    const porCliente = new Map(clientes.map((c) => [String(c._id), c]));
    const porServicio = new Map(servicios.map((s) => [String(s._id), s.titulo]));

    return reservas.map((reserva) => {
      const cliente = porCliente.get(String(reserva.usuarioId));
      return {
        ...reserva,
        clienteNombre: cliente?.nombre,
        clienteEmail: cliente?.email,
        clienteTelefono: cliente?.telefono,
        servicioTitulo: porServicio.get(String(reserva.servicioId)),
        // El nombre viaja en la copia congelada del perro: no hace falta ir a
        // su ficha, y sigue estando aunque el cliente la borre después.
        perroNombre: reserva.perroSnapshot?.['nombre'] as string | undefined,
      };
    });
  }

  /**
   * Finanzas reales del comercio calculadas en el backend a partir de los pagos
   * (no en el front): facturación bruta, comisión, Stripe, reembolsos y la
   * liquidación neta. La "próxima liquidación" es lo ya prestado pendiente de
   * pagar (completadas / pago retenido) que todavía no se ha liberado.
   */
  async obtenerFinanzasComercio(comercioId: string): Promise<{
    facturacionBruta: number;
    comisionPlataforma: number;
    stripeFee: number;
    reembolsos: number;
    liquidacion: number;
    proximaLiquidacion: number;
    reservasPagadas: number;
  }> {
    this.exigirComercio(comercioId);
    const reservas = await this.reservaModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .select('_id estado')
      .lean()
      .exec() as unknown as Array<{ _id: Types.ObjectId; estado: string }>;

    if (reservas.length === 0) {
      return { facturacionBruta: 0, comisionPlataforma: 0, stripeFee: 0, reembolsos: 0, liquidacion: 0, proximaLiquidacion: 0, reservasPagadas: 0 };
    }

    const estadoPorReserva = new Map(reservas.map((r) => [String(r._id), r.estado]));
    const reservaIds = reservas.map((r) => r._id);

    const pagos = await this.pagoModel
      .find({ reservaId: { $in: reservaIds }, estado: PagoEstado.APROBADO })
      .select('reservaId montoTotal comisionPlataforma stripeFee montoLiquidacion')
      .lean()
      .exec() as unknown as Array<{ reservaId: Types.ObjectId; montoTotal: number; comisionPlataforma: number; stripeFee: number; montoLiquidacion: number }>;

    const acc = { facturacionBruta: 0, comisionPlataforma: 0, stripeFee: 0, reembolsos: 0, liquidacion: 0, proximaLiquidacion: 0 };
    const estadosPendientesPago = new Set<string>([ReservaEstado.COMPLETADA, ReservaEstado.PAGO_RETENIDO, ReservaEstado.CONFIRMADA]);

    for (const pago of pagos) {
      const estado = estadoPorReserva.get(String(pago.reservaId));
      if (estado === ReservaEstado.REEMBOLSADA) {
        acc.reembolsos += pago.montoLiquidacion;
        continue;
      }
      acc.facturacionBruta += pago.montoTotal;
      acc.comisionPlataforma += pago.comisionPlataforma;
      acc.stripeFee += pago.stripeFee;
      acc.liquidacion += pago.montoLiquidacion;
      if (estado && estadosPendientesPago.has(estado)) acc.proximaLiquidacion += pago.montoLiquidacion;
    }

    const redondear = (n: number): number => Math.round(n * 100) / 100;
    return {
      facturacionBruta: redondear(acc.facturacionBruta),
      comisionPlataforma: redondear(acc.comisionPlataforma),
      stripeFee: redondear(acc.stripeFee),
      reembolsos: redondear(acc.reembolsos),
      liquidacion: redondear(acc.liquidacion),
      proximaLiquidacion: redondear(acc.proximaLiquidacion),
      reservasPagadas: pagos.length,
    };
  }

  async obtenerServiciosComercio(comercioId: string): Promise<ServicioDocument[]> {
    this.exigirComercio(comercioId);
    return this.servicioModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ prioridadRanking: -1, createdAt: -1 })
      .lean()
      .exec() as unknown as ServicioDocument[];
  }

  // ── Equipo y permisos (Fase 4) ───────────────────────────────────────────────

  async obtenerEquipo(comercioId: string): Promise<UsuarioDocument[]> {
    this.exigirComercio(comercioId);
    return this.usersRepo.listarPorComercio(comercioId);
  }

  /** El comercio_admin da de alta a un miembro del equipo (comercio_staff). */
  async crearMiembroEquipo(
    comercioId: string,
    datos: { nombre: string; email: string; password: string; telefono?: string; puesto?: string },
  ): Promise<UsuarioDocument> {
    this.exigirComercio(comercioId);
    if (await this.usersRepo.findByEmail(datos.email)) {
      throw new DomainException('Ya existe un usuario con ese email', 409);
    }
    const passwordHash = await bcrypt.hash(datos.password, 10);
    return this.usersRepo.crear({
      nombre: datos.nombre,
      email: datos.email,
      passwordHash,
      telefono: datos.telefono,
      rol: Rol.COMERCIO_STAFF,
      comercioId,
      puesto: datos.puesto,
    });
  }

  /** Baja de un miembro del equipo; solo staff del propio comercio y nunca a uno mismo. */
  /**
   * Actualiza puesto, acceso o estado de un miembro. El puesto es lo que hace y
   * los permisos lo que puede tocar: son cosas distintas (TCK-8026/8027).
   */
  async actualizarMiembroEquipo(
    comercioId: string,
    miembroId: string,
    solicitanteId: string,
    datos: { puesto?: string; permisosComercio?: string[]; activo?: boolean },
  ): Promise<UsuarioDocument> {
    this.exigirComercio(comercioId);
    const miembro = await this.usersRepo.findById(miembroId);
    if (!miembro || miembro.comercioId?.toString() !== comercioId) {
      throw new DomainException('Miembro no encontrado en tu equipo', 404);
    }
    if (miembroId === solicitanteId && datos.activo === false) {
      throw new DomainException('No puedes desactivarte a ti mismo', 400);
    }

    const actualizado = await this.usersRepo.actualizarAdmin(miembroId, datos);
    if (!actualizado) {
      throw new DomainException('Miembro no encontrado en tu equipo', 404);
    }
    return actualizado;
  }

  async eliminarMiembroEquipo(comercioId: string, miembroId: string, solicitanteId: string): Promise<void> {
    this.exigirComercio(comercioId);
    if (miembroId === solicitanteId) {
      throw new DomainException('No puedes eliminarte a ti mismo del equipo', 400);
    }
    const miembro = await this.usersRepo.findById(miembroId);
    if (!miembro || miembro.comercioId?.toString() !== comercioId) {
      throw new DomainException('Miembro no encontrado en tu equipo', 404);
    }
    if (miembro.rol !== Rol.COMERCIO_STAFF) {
      throw new DomainException('Solo puedes eliminar miembros con rol de staff', 400);
    }
    await this.usersRepo.eliminar(miembroId);
  }

  async cambiarEstadoServicio(
    servicioId: string,
    comercioId: string,
    estado: 'publicado' | 'pausado' | 'borrador',
  ): Promise<ServicioDocument> {
    const actual = await this.servicioModel.findOne(
      { _id: new Types.ObjectId(servicioId), comercioId: new Types.ObjectId(comercioId) },
    ).lean().exec() as Record<string, unknown> | null;
    if (!actual) throw new DomainException('Servicio no encontrado', 404);

    // El alta guiada se puede aparcar ("todavía no tengo los datos") y el
    // servicio queda en borrador. Publicar antes de cerrarla pondría en el
    // buscador una ficha sin datos de contacto ni condiciones aceptadas, que es
    // justo lo que la pantalla del alta promete que no va a pasar.
    if (estado === 'publicado') {
      const comercio = await this.repo.findById(comercioId);
      if (comercio && !comercio.altaCompletada) {
        throw new DomainException(
          'Termina el alta de tu negocio para poder publicar tus servicios.', 409,
        );
      }
    }

    // Publicar con el contador de plazas a cero deja el listado invisible en la
    // web pese a aparecer como publicado en el panel, que es justo lo que el
    // comercio no entiende. Si nunca se fijó, se deduce aquí de la capacidad
    // declarada: se publica algo que de verdad se puede encontrar.
    const cambios: Record<string, unknown> = { estado };
    const contador = campoContador(actual['vertical'] as string);
    if (estado === 'publicado' && contador && sinPlazas(actual[contador])) {
      const plazas = plazasDeclaradas(actual['vertical'] as string, actual);
      if (plazas !== undefined) cambios[contador] = plazas;
    }

    const servicio = await this.servicioModel.findOneAndUpdate(
      { _id: new Types.ObjectId(servicioId), comercioId: new Types.ObjectId(comercioId) },
      cambios,
      { new: true },
    ).exec();
    if (!servicio) throw new DomainException('Servicio no encontrado', 404);
    return servicio as unknown as ServicioDocument;
  }

  async actualizarComercio(
    comercioId: string,
    dto: ActualizarPerfilComercioDto,
  ): Promise<ComercioDocument> {
    const { consentimientos, ...resto } = dto;
    const datos: Record<string, unknown> = { ...resto };

    if (consentimientos) {
      datos.consentimientos = this.sellarConsentimientos(consentimientos);
    }

    // Cambiar el CIF exige que siga siendo único: el índice de Mongo lo
    // rechazaría con un E11000 que el panel no sabe traducir.
    if (dto.vatNumber) {
      const otro = await this.repo.findByVatNumber(dto.vatNumber);
      if (otro && otro.id !== comercioId) {
        throw new DomainException('Ya existe un comercio con ese identificador fiscal', 409);
      }
    }

    const actualizado = await this.repo.actualizar(comercioId, datos);
    if (!actualizado) throw new DomainException('Comercio no encontrado', 404);

    return actualizado;
  }

  /**
   * Sella las aceptaciones con la fecha y la versión del texto vigente.
   *
   * La marca la pone el servidor a propósito: si el cliente pudiera mandarla, la
   * prueba de consentimiento —que es para lo único que sirve guardar esto— no
   * valdría nada. Desmarcar una casilla retira la aceptación y con ella su
   * fecha; dejar la fecha de una aceptación revocada sería peor que no tenerla.
   */
  private sellarConsentimientos(dto: ConsentimientosComercioDto): ConsentimientosComercio {
    const sellar = (aceptado: boolean): Consentimiento =>
      aceptado
        ? { aceptado: true, fecha: new Date(), version: CONDICIONES_COMERCIO_VERSION }
        : { aceptado: false };

    return {
      operaLegalmente: sellar(dto.operaLegalmente),
      condicionesGenerales: sellar(dto.condicionesGenerales),
    };
  }

  /** Reseñas recibidas por el comercio (delegado al módulo transversal de reviews). */
  obtenerResenasComercio(comercioId: string): Promise<unknown[]> {
    return this.reviewsService.listarPorComercio(comercioId);
  }

  /** Responde a una reseña recibida; valida que pertenezca al comercio. */
  responderResena(resenaId: string, comercioId: string, respuesta: string): Promise<unknown> {
    return this.reviewsService.responder(resenaId, comercioId, respuesta);
  }

  /** El comercio marca como completado un servicio ya prestado. */
  completarReserva(reservaId: string, comercioId: string): Promise<ReservaDocument> {
    return this.bookingsService.completar(reservaId, comercioId);
  }

  marcarSeguimiento(reservaId: string, comercioId: string, hito: string, nota?: string): Promise<ReservaDocument> {
    return this.bookingsService.agregarSeguimiento(reservaId, comercioId, hito, nota);
  }

  /** El comercio detecta en recepción condiciones no indicadas y propone un suplemento. */
  solicitarAjusteReserva(
    reservaId: string,
    comercioId: string,
    dto: SolicitarAjusteDto,
  ): Promise<ReservaDocument> {
    return this.bookingsService.solicitarAjuste(reservaId, comercioId, dto.suplementos, dto.evidenciaUrl);
  }

  /** El comercio actualiza la disponibilidad/cupos de uno de sus servicios (D1). */
  actualizarDisponibilidadServicio(
    servicioId: string,
    comercioId: string,
    dto: ActualizarDisponibilidadDto,
  ): Promise<ServicioCardDto> {
    return this.catalogService.actualizarDisponibilidad(servicioId, comercioId, dto);
  }
}
