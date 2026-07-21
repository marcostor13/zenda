import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ComerciosRepository } from './comercios.repository';
import { ComercioDocument, EstadoComercio, EstadoVerificacion } from './comercio.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { Pago, PagoDocument } from '../payments/pago.schema';
import { PagoEstado, ReservaEstado } from 'shared';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService, ServicioCardDto } from '../catalog/catalog.service';
import { AuthService } from '../auth/auth.service';
import { UsersRepository } from '../users/users.repository';
import { UsuarioDocument } from '../users/usuario.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { RegistrarComercioDto, RegistroComercioDto, ActualizarDisponibilidadDto, AuthResponseDto, Rol, ActualizarPerfilComercioDto, SolicitarAjusteDto } from 'shared';

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
      logoUrl: dto.logoUrl,
      verticales: dto.verticales,
    });
  }

  /**
   * Alta de comercio en un solo paso (self-service, "Hazte partner"): crea el
   * negocio y la cuenta comercio_admin que lo gestiona, y devuelve la sesión
   * ya autenticada para no exigir un login adicional.
   */
  async registrarConCuenta(dto: RegistroComercioDto): Promise<AuthResponseDto> {
    if (await this.usersRepo.findByEmail(dto.email)) {
      throw new DomainException('El email ya está registrado', 409);
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

    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const usuario = await this.usersRepo.crear({
        nombre: dto.nombre,
        email: dto.email,
        passwordHash,
        telefono: dto.telefono,
        rol: Rol.COMERCIO_ADMIN,
        comercioId: comercio.id,
      });
      return await this.authService.emitirTokenParaUsuario(usuario);
    } catch (error) {
      // El comercio no debe quedar huérfano si la creación del usuario falla.
      await this.repo.eliminar(comercio.id);
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

  async listar(estado?: EstadoComercio): Promise<ComercioDocument[]> {
    return this.repo.listar(estado ? { estado } : {});
  }

  async cambiarEstado(id: string, estado: EstadoComercio): Promise<ComercioDocument> {
    const comercio = await this.repo.actualizarEstado(id, estado);
    if (!comercio) {
      throw new DomainException('Comercio no encontrado', 404);
    }
    return comercio;
  }

  private exigirComercio(comercioId: string): void {
    if (!comercioId) {
      throw new DomainException('Tu cuenta no está vinculada a ningún comercio.', 403);
    }
  }

  async obtenerReservasComercio(
    comercioId: string,
    limite = 20,
  ): Promise<ReservaDocument[]> {
    this.exigirComercio(comercioId);
    return this.reservaModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ createdAt: -1 })
      .limit(limite)
      .lean()
      .exec() as unknown as ReservaDocument[];
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
    const servicio = await this.servicioModel.findOneAndUpdate(
      { _id: new Types.ObjectId(servicioId), comercioId: new Types.ObjectId(comercioId) },
      { estado },
      { new: true },
    ).exec();
    if (!servicio) throw new DomainException('Servicio no encontrado', 404);
    return servicio as unknown as ServicioDocument;
  }

  async actualizarComercio(
    comercioId: string,
    dto: ActualizarPerfilComercioDto,
  ): Promise<ComercioDocument> {
    const { documentoIdentidadUrl, licenciaNegocioUrl, documentos, ...resto } = dto as ActualizarPerfilComercioDto & {
      documentos?: Array<{ tipo: string; nombre?: string; url: string; fechaCaducidad?: string }>;
    };
    const datos: Record<string, unknown> = { ...resto };

    if (documentoIdentidadUrl !== undefined || licenciaNegocioUrl !== undefined || documentos !== undefined) {
      const actual = await this.repo.findById(comercioId);
      const verificacionActual = actual?.verificacion ?? { estado: 'sin_verificar' as EstadoVerificacion };
      const nuevoDocumentoIdentidad = documentoIdentidadUrl ?? verificacionActual.documentoIdentidadUrl;
      const nuevaLicencia = licenciaNegocioUrl ?? verificacionActual.licenciaNegocioUrl;

      // Cada documento declarado por el comercio entra como 'pendiente' de revisión;
      // se marca 'caducado' automáticamente si su fecha de caducidad ya pasó.
      const ahora = new Date();
      const documentosNormalizados = documentos !== undefined
        ? documentos.map((d) => ({
            tipo: d.tipo,
            nombre: d.nombre,
            url: d.url,
            fechaCaducidad: d.fechaCaducidad,
            estado: (d.fechaCaducidad && new Date(d.fechaCaducidad) < ahora ? 'caducado' : 'pendiente') as
              'pendiente' | 'caducado',
            subidoAt: ahora,
          }))
        : verificacionActual.documentos;

      const tieneDocumentacion = Boolean(nuevoDocumentoIdentidad && nuevaLicencia) || Boolean(documentosNormalizados?.length);
      datos.verificacion = {
        estado: tieneDocumentacion ? 'pendiente' : verificacionActual.estado,
        documentoIdentidadUrl: nuevoDocumentoIdentidad,
        licenciaNegocioUrl: nuevaLicencia,
        documentos: documentosNormalizados,
      };
    }

    const actualizado = await this.repo.actualizar(comercioId, datos);
    if (!actualizado) throw new DomainException('Comercio no encontrado', 404);
    return actualizado;
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
