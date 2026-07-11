import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ComerciosRepository } from './comercios.repository';
import { ComercioDocument, EstadoComercio } from './comercio.schema';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Servicio, ServicioDocument } from '../catalog/servicio.schema';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { AuthService } from '../auth/auth.service';
import { UsersRepository } from '../users/users.repository';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { RegistrarComercioDto, RegistroComercioDto, AuthResponseDto, Rol } from 'shared';

@Injectable()
export class ComerciosService {
  constructor(
    private readonly repo: ComerciosRepository,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    private readonly reviewsService: ReviewsService,
    private readonly bookingsService: BookingsService,
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

  async obtenerReservasComercio(
    comercioId: string,
    limite = 20,
  ): Promise<ReservaDocument[]> {
    return this.reservaModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ createdAt: -1 })
      .limit(limite)
      .lean()
      .exec() as unknown as ReservaDocument[];
  }

  async obtenerServiciosComercio(comercioId: string): Promise<ServicioDocument[]> {
    return this.servicioModel
      .find({ comercioId: new Types.ObjectId(comercioId) })
      .sort({ prioridadRanking: -1, createdAt: -1 })
      .lean()
      .exec() as unknown as ServicioDocument[];
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
    datos: Partial<{ nombreComercial: string; logoUrl: string }>,
  ): Promise<ComercioDocument> {
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
}
