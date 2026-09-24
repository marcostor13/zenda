import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HitoViaje, PosicionViajeDto, ReservaEstado, UbicacionViajeRespuesta, normalizarHitoViaje } from 'shared';
import { Reserva, ReservaDocument } from '../bookings/reserva.schema';
import { Comercio, ComercioDocument } from '../comercios/comercio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { PosicionViaje, PosicionViajeDocument } from './posicion-viaje.schema';

/** Contacto del comercio que ve el cliente con la reserva en marcha (D2: llamar y WhatsApp). */
export interface ContactoReserva {
  nombre: string;
  telefono?: string;
  whatsapp?: string;
}

/** Sin posición en este tiempo, el conductor ha dejado de compartir (cerró la app, sin cobertura…). */
const MINUTOS_SIN_SENAL = 3;
/** Por debajo de esto, una posición nueva no aporta nada al mapa y sólo llena la colección. */
const SEGUNDOS_ENTRE_POSICIONES = 5;
const MAX_PUNTOS_RASTRO = 120;

const ESTADOS_ACTIVOS: readonly ReservaEstado[] = [ReservaEstado.CONFIRMADA, ReservaEstado.EN_CURSO];
const HITOS_FINALES: readonly string[] = [HitoViaje.ENTREGADA, HitoViaje.FINALIZADA];

/**
 * Seguimiento en vivo de una reserva (D3) y contacto con el comercio (D2).
 *
 * El conductor manda su posición desde el panel del comercio mientras el viaje
 * está en marcha; el cliente la consulta cada pocos segundos. Sólo se acepta
 * con la reserva viva y antes de la entrega: después ya no hay nada que seguir
 * y guardar posiciones sería rastrear a una persona sin motivo.
 */
@Injectable()
export class SeguimientoService {
  constructor(
    @InjectModel(PosicionViaje.name) private readonly posicionModel: Model<PosicionViajeDocument>,
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    @InjectModel(Comercio.name) private readonly comercioModel: Model<ComercioDocument>,
  ) {}

  async registrarPosicion(reservaId: string, comercioId: string, dto: PosicionViajeDto): Promise<{ ok: true }> {
    const reserva = await this.reserva(reservaId);
    if (reserva.comercioId.toString() !== comercioId) {
      throw new DomainException('No tienes permiso sobre esta reserva', 403);
    }
    if (!this.admiteUbicacion(reserva)) {
      throw new DomainException('Este viaje no está en marcha: no hace falta compartir la ubicación.', 409);
    }

    const ultima = await this.ultimaPosicion(reserva._id);
    if (ultima && Date.now() - ultima.at.getTime() < SEGUNDOS_ENTRE_POSICIONES * 1000) return { ok: true };

    await this.posicionModel.create({ reservaId: reserva._id, ...dto, at: new Date() });
    return { ok: true };
  }

  async ubicacion(reservaId: string, usuarioId: string): Promise<UbicacionViajeRespuesta> {
    const reserva = await this.reserva(reservaId);
    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para ver esta reserva', 403);
    }

    const ruta = reserva.detalle?.['ruta'] as { origen?: { lat: number; lng: number }; destino?: { lat: number; lng: number } } | undefined;
    const posiciones = await this.posicionModel
      .find({ reservaId: reserva._id })
      .sort({ at: -1 })
      .limit(MAX_PUNTOS_RASTRO)
      .select('lat lng rumbo at')
      .lean()
      .exec();

    const ultima = posiciones[0];
    const reciente = !!ultima && Date.now() - ultima.at.getTime() < MINUTOS_SIN_SENAL * 60_000;
    return {
      compartiendo: reciente && this.admiteUbicacion(reserva),
      posicion: ultima ? { lat: ultima.lat, lng: ultima.lng, rumbo: ultima.rumbo, at: ultima.at.toISOString() } : undefined,
      rastro: posiciones.reverse().map((p) => ({ lat: p.lat, lng: p.lng })),
      origen: ruta?.origen,
      destino: ruta?.destino,
    };
  }

  /** Teléfono y WhatsApp del comercio, sólo mientras la reserva está pagada y viva. */
  async contacto(reservaId: string, usuarioId: string): Promise<ContactoReserva> {
    const reserva = await this.reserva(reservaId);
    if (reserva.usuarioId.toString() !== usuarioId) {
      throw new DomainException('No tienes permiso para ver esta reserva', 403);
    }
    if (!ESTADOS_ACTIVOS.includes(reserva.estado) && reserva.estado !== ReservaEstado.COMPLETADA) {
      throw new DomainException('El contacto se muestra cuando la reserva está confirmada.', 409);
    }
    const comercio = await this.comercioModel
      .findById(reserva.comercioId)
      .select('nombreComercial contacto telefono')
      .lean()
      .exec() as { nombreComercial?: string; contacto?: { telefono?: string; whatsapp?: string }; telefono?: string } | null;
    return {
      nombre: comercio?.nombreComercial ?? 'El comercio',
      telefono: comercio?.contacto?.telefono ?? comercio?.telefono,
      whatsapp: comercio?.contacto?.whatsapp ?? comercio?.contacto?.telefono ?? comercio?.telefono,
    };
  }

  private admiteUbicacion(reserva: ReservaDocument): boolean {
    if (!ESTADOS_ACTIVOS.includes(reserva.estado)) return false;
    if (reserva.aceptacion?.estado === 'pendiente') return false;
    const hitos = (reserva.seguimiento ?? []).map((h) => normalizarHitoViaje(h.hito));
    return !hitos.some((h) => HITOS_FINALES.includes(h));
  }

  private async reserva(reservaId: string): Promise<ReservaDocument> {
    const reserva = Types.ObjectId.isValid(reservaId) ? await this.reservaModel.findById(reservaId).exec() : null;
    if (!reserva) throw new DomainException('Reserva no encontrada', 404);
    return reserva;
  }

  private ultimaPosicion(reservaId: Types.ObjectId): Promise<{ at: Date } | null> {
    return this.posicionModel.findOne({ reservaId }).sort({ at: -1 }).select('at').lean().exec();
  }
}
