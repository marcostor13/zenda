import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnadirItemCarritoDto, ValidacionCarritoDto, VerticalKey } from 'shared';
import { nanoid } from 'nanoid';
import { Carrito, CarritoDocument, ItemCarrito } from './carrito.schema';
import { AvailabilityRegistry } from '../availability/availability.registry';
import { BookingsService } from '../bookings/bookings.service';
import { CatalogService } from '../catalog/catalog.service';
import { ReservaDocument } from '../bookings/reserva.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';

/** Un carrito abierto caduca a las 24 h; pasado ese plazo deja de estorbar. */
const TTL_CARRITO_HORAS = 24;

export interface ResultadoCheckout {
  reservas: ReservaDocument[];
  /** Reserva principal del viaje, si el carrito la designó. */
  reservaMadreId?: string;
  montoSubtotalTotal: number;
}

/**
 * Carrito multi-vertical: por fuera, un solo viaje; por dentro, **una reserva
 * independiente por servicio** (decisión D-1 del plan unificado).
 *
 * No es una "reserva compuesta": cada línea conserva su comercio, su precio, su
 * comisión, su disponibilidad y su política de cancelación, que es lo único
 * compatible con poder cancelar una sin tumbar el resto (HU-035).
 */
@Injectable()
export class CarritoService {
  private readonly logger = new Logger(CarritoService.name);

  constructor(
    @InjectModel(Carrito.name) private readonly carritoModel: Model<CarritoDocument>,
    private readonly availabilityRegistry: AvailabilityRegistry,
    private readonly bookingsService: BookingsService,
    private readonly catalogService: CatalogService,
  ) {}

  /** Carrito abierto del usuario; lo crea vacío si aún no tiene ninguno. */
  async obtenerAbierto(usuarioId: string): Promise<CarritoDocument> {
    const existente = await this.carritoModel
      .findOne({ usuarioId: new Types.ObjectId(usuarioId), estado: 'abierto' })
      .exec();

    if (existente) return existente;

    return this.carritoModel.create({
      usuarioId: new Types.ObjectId(usuarioId),
      estado: 'abierto',
      items: [],
      expiraEn: new Date(Date.now() + TTL_CARRITO_HORAS * 60 * 60 * 1000),
    });
  }

  async anadirItem(usuarioId: string, dto: AnadirItemCarritoDto): Promise<CarritoDocument> {
    const carrito = await this.obtenerAbierto(usuarioId);
    const servicio = await this.catalogService.obtenerServicio(dto.servicioId);

    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : undefined;
    const cantidad = dto.cantidad ?? 1;

    // El vertical sale del servicio, no del cuerpo de la petición: de él dependen
    // la estrategia de disponibilidad y el porcentaje de comisión. Si el cliente
    // manda otro, `BookingsService.crear` rechazaría el checkout más tarde; se
    // corrige aquí para no meter en el carrito algo que no se podrá pagar.
    const vertical = (servicio.vertical as VerticalKey | undefined) ?? dto.vertical;

    // Se comprueba al añadir para no dejar meter algo que ya no existe, pero
    // NO se bloquea plaza: el hold se toma en el checkout.
    const disponibilidad = await this.comprobarDisponibilidad(
      vertical, dto.servicioId, fechaInicio, fechaFin, cantidad, dto.detalle,
    );
    if (!disponibilidad.disponible) {
      throw new DomainException(
        `${servicio.nombre} no tiene disponibilidad para esas fechas.`,
        409,
      );
    }

    // El comercio se toma del servicio, no de lo que diga el cliente.
    const comercioId = servicio.comercioId || dto.comercioId;
    if (!comercioId) {
      throw new DomainException('El servicio no está vinculado a ningún comercio', 409);
    }

    const item: ItemCarrito = {
      itemId: nanoid(10),
      servicioId: new Types.ObjectId(dto.servicioId),
      comercioId: new Types.ObjectId(comercioId),
      vertical,
      titulo: servicio.nombre,
      fechaInicio,
      fechaFin,
      cantidad,
      perroIds: dto.perroIds ?? [],
      detalle: dto.detalle ?? {},
      precioEstimado: disponibilidad.precio ?? servicio.precioPorNoche,
      esReservaMadre: dto.esReservaMadre ?? false,
    };

    // Solo puede haber un eje del viaje.
    if (item.esReservaMadre) {
      carrito.items = carrito.items.map((i) => ({ ...i, esReservaMadre: false }));
    }

    carrito.items.push(item);
    return carrito.save();
  }

  async quitarItem(usuarioId: string, itemId: string): Promise<CarritoDocument> {
    const carrito = await this.obtenerAbierto(usuarioId);
    const antes = carrito.items.length;

    carrito.items = carrito.items.filter((i) => i.itemId !== itemId);
    if (carrito.items.length === antes) {
      throw new DomainException('Ese servicio no está en tu viaje', 404);
    }

    return carrito.save();
  }

  /**
   * Revalida **todos** los items justo antes de cobrar (HU-036). Entre añadir
   * al carrito y pagar pueden pasar horas: sin esta comprobación se vendería
   * algo que ya no existe.
   */
  async validar(usuarioId: string): Promise<ValidacionCarritoDto> {
    const carrito = await this.obtenerAbierto(usuarioId);

    const items = await Promise.all(
      carrito.items.map(async (item) => {
        const resultado = await this.comprobarDisponibilidad(
          item.vertical, item.servicioId.toString(), item.fechaInicio,
          item.fechaFin, item.cantidad, item.detalle,
        );
        return {
          itemId: item.itemId,
          titulo: item.titulo,
          disponible: resultado.disponible,
          motivo: resultado.disponible ? undefined : 'Sin disponibilidad para esas fechas',
        };
      }),
    );

    return { todoDisponible: items.every((i) => i.disponible), items };
  }

  /**
   * Convierte el viaje en reservas reales.
   *
   * Orden deliberado: primero se revalida **todo**; si algo falla, no se crea
   * ninguna reserva y el carrito se conserva intacto para que el usuario
   * corrija solo la línea afectada.
   */
  async checkout(usuarioId: string): Promise<ResultadoCheckout> {
    const carrito = await this.obtenerAbierto(usuarioId);

    if (!carrito.items.length) {
      throw new DomainException('Tu viaje está vacío', 400);
    }

    const validacion = await this.validar(usuarioId);
    if (!validacion.todoDisponible) {
      const caidos = validacion.items.filter((i) => !i.disponible).map((i) => i.titulo);
      throw new DomainException(
        `Ya no hay disponibilidad para: ${caidos.join(', ')}. Quítalo del viaje o cambia las fechas; el resto sigue reservado.`,
        409,
      );
    }

    carrito.estado = 'procesando';
    await carrito.save();

    const reservas: ReservaDocument[] = [];
    try {
      // La madre se crea primero para poder vincular las demás a ella.
      const ordenados = [...carrito.items].sort(
        (a, b) => Number(b.esReservaMadre) - Number(a.esReservaMadre),
      );

      for (const item of ordenados) {
        const reserva = await this.bookingsService.crear({
          usuarioId,
          comercioId: item.comercioId.toString(),
          servicioId: item.servicioId.toString(),
          vertical: item.vertical,
          perroId: item.perroIds[0],
          fechaInicio: item.fechaInicio,
          fechaFin: item.fechaFin,
          cantidad: item.cantidad,
          detalle: item.detalle,
        });

        reserva.carritoId = carrito._id;
        if (!item.esReservaMadre && reservas.length && reservas[0].reservaMadreId === undefined) {
          reserva.reservaMadreId = reservas[0]._id;
        }
        await reserva.save();
        reservas.push(reserva);
      }
    } catch (error) {
      // Una línea ha fallado a mitad: se liberan las plazas ya tomadas para no
      // dejar inventario retenido por un viaje que nunca se cobrará.
      await this.revertirReservas(reservas);
      carrito.estado = 'abierto';
      await carrito.save();
      throw error;
    }

    carrito.reservaIds = reservas.map((r) => r._id);
    await carrito.save();

    const madre = carrito.items.some((i) => i.esReservaMadre) ? reservas[0] : undefined;

    return {
      reservas,
      reservaMadreId: madre?._id.toString(),
      montoSubtotalTotal:
        Math.round(reservas.reduce((suma, r) => suma + r.montoSubtotal, 0) * 100) / 100,
    };
  }

  /** Marca el carrito como confirmado tras un pago aprobado. */
  async marcarConfirmado(carritoId: string): Promise<void> {
    await this.carritoModel
      .updateOne({ _id: new Types.ObjectId(carritoId) }, { $set: { estado: 'confirmado' } })
      .exec();
  }

  /** Devuelve el carrito a "abierto" si el pago no llegó a completarse. */
  async devolverAAbierto(carritoId: string): Promise<void> {
    await this.carritoModel
      .updateOne(
        { _id: new Types.ObjectId(carritoId), estado: 'procesando' },
        { $set: { estado: 'abierto', reservaIds: [] } },
      )
      .exec();
  }

  private async comprobarDisponibilidad(
    vertical: VerticalKey,
    servicioId: string,
    fechaInicio: Date,
    fechaFin: Date | undefined,
    cantidad: number,
    detalle?: Record<string, unknown>,
  ): Promise<{ disponible: boolean; precio?: number }> {
    try {
      const estrategia = this.availabilityRegistry.obtener(vertical);
      const resultado = await estrategia.checkAvailability(servicioId, {
        fechaInicio, fechaFin, cantidad, parametrosExtra: detalle,
      });
      return { disponible: resultado.disponible, precio: resultado.precioCalculado };
    } catch (error) {
      this.logger.warn(`No se pudo comprobar la disponibilidad de ${servicioId}: ${error}`);
      return { disponible: false };
    }
  }

  private async revertirReservas(reservas: ReservaDocument[]): Promise<void> {
    for (const reserva of reservas) {
      try {
        await this.bookingsService.cancelar(reserva._id.toString(), reserva.usuarioId.toString());
      } catch (error) {
        this.logger.error(`No se pudo revertir la reserva ${reserva._id}: ${error}`);
      }
    }
  }
}
