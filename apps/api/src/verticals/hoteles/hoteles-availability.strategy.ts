import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VerticalKey, TamanoPerro } from 'shared';
import {
  AvailabilityStrategy,
  AvailabilityQuery,
  AvailabilityResult,
  CalendarioStrategy,
  DiaCalendario,
  RangoCalendario,
  ReserveParams,
  SlotHold,
} from '../../core/availability/availability.strategy';
import {
  OcupacionRepository, claveDia, inicioDelDia, nochesDe,
} from '../../core/availability/ocupacion.repository';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Hoteles, SuplementoPorTamanoMascota } from './hoteles.schema';

const MINUTOS_TTL = 15;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

interface HoldEntry { holdId: string; servicioId: string; expiraEn: Date; }

/**
 * Vertical Hotel/alojamiento pet-friendly: se reserva alojamiento para las personas,
 * condicionado a las características de su mascota (docs/mejora_servicios.md §6).
 * Precio = precioBase (habitación) × noches + suplemento por tamaño de mascota × noches
 * + suplemento por mascota adicional × noches × (mascotas - 1).
 */
@Injectable()
export class HotelesAvailabilityStrategy implements AvailabilityStrategy, CalendarioStrategy {
  readonly vertical = VerticalKey.HOTELES;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    private readonly ocupacion: OcupacionRepository,
  ) {}

  /**
   * Noche a noche, cuántas habitaciones quedan libres. Misma cuenta que hace
   * `checkAvailability`: el calendario no puede pintar libre una noche que
   * luego la reserva rechace.
   */
  async calendario(servicioId: string, rango: RangoCalendario): Promise<DiaCalendario[]> {
    const hotel = await this.servicioModel.findById(servicioId).lean().exec() as (Hoteles & { _id: unknown }) | null;

    if (!hotel) {
      throw new DomainException('Hotel pet-friendly no encontrado', 404);
    }

    const unidades = hotel.admiteMascotas ? (hotel.unidadesDisponibles ?? 0) : 0;
    const ocupadas = await this.ocupacion.nochesOcupadas({
      servicioId, desde: rango.desde, hasta: rango.hasta,
    });

    const hoy = claveDia(new Date());
    const dias: DiaCalendario[] = [];

    for (
      let dia = inicioDelDia(rango.desde);
      dia.getTime() <= inicioDelDia(rango.hasta).getTime();
      dia = new Date(dia.getTime() + MS_POR_DIA)
    ) {
      const fecha = claveDia(dia);
      const libres = Math.max(0, unidades - (ocupadas.get(fecha) ?? 0));
      dias.push({ fecha, disponible: libres > 0 && fecha >= hoy, plazasLibres: libres });
    }

    return dias;
  }

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const hotel = await this.servicioModel.findById(servicioId).lean().exec() as (Hoteles & { _id: unknown }) | null;

    if (!hotel) {
      throw new DomainException('Hotel pet-friendly no encontrado', 404);
    }

    if (!params.fechaFin) {
      throw new DomainException('Se requiere fechaFin para reservar un hotel pet-friendly', 400);
    }

    if (!hotel.admiteMascotas || (hotel.unidadesDisponibles ?? 0) <= 0) {
      return {
        disponible: false,
        motivo: hotel.admiteMascotas
          ? 'No quedan habitaciones libres en este hotel para las fechas elegidas.'
          : 'Este hotel ya no admite mascotas.',
        capacidadRestante: hotel.unidadesDisponibles ?? 0,
      };
    }

    const noches = this.calcularNoches(params.fechaInicio, params.fechaFin);
    if (noches <= 0) {
      return { disponible: false, motivo: 'La fecha de salida tiene que ser posterior a la de ingreso.' };
    }

    // `unidadesDisponibles` son las habitaciones del hotel, no las libres esas
    // noches: sin esta comprobación se aceptaban dos reservas sobre la misma.
    const nocheLlena = await this.primeraNocheLlena(servicioId, hotel, params);
    if (nocheLlena) {
      return {
        disponible: false,
        motivo: 'No quedan habitaciones libres en alguna de las noches elegidas. Prueba con otras fechas.',
        capacidadRestante: 0,
        metadata: { nocheLlena },
      };
    }

    const mascotas = Math.max(1, params.cantidad ?? 1);
    this.validarCantidadMascotas(hotel, mascotas);
    this.validarPeso(hotel, params);
    this.validarEspecie(hotel, params);
    this.validarRaza(hotel, params);

    const tier = this.tierPorTamano(hotel, params);
    const suplementoTamano = (tier?.precioPorNoche ?? 0) * noches;
    const suplementoAdicionales = mascotas > 1
      ? (hotel.suplementoSegundaMascotaPorNoche ?? 0) * noches * (mascotas - 1)
      : 0;
    const precioCalculado = hotel.precioBase * noches + suplementoTamano + suplementoAdicionales;

    return {
      disponible: true,
      capacidadRestante: hotel.unidadesDisponibles,
      precioCalculado: Math.round(precioCalculado * 100) / 100,
      metadata: { noches, mascotas },
    };
  }

  /** Primera noche del rango sin habitación libre, o null si caben todas. */
  private async primeraNocheLlena(
    servicioId: string,
    hotel: Hoteles,
    params: AvailabilityQuery,
  ): Promise<string | null> {
    if (!params.fechaFin) return null;

    const unidades = hotel.unidadesDisponibles ?? 0;
    const ocupadas = await this.ocupacion.nochesOcupadas({
      servicioId, desde: params.fechaInicio, hasta: params.fechaFin,
    });

    return nochesDe(params.fechaInicio, params.fechaFin)
      .find((noche) => (ocupadas.get(noche) ?? 0) >= unidades) ?? null;
  }

  async reserveSlot(servicioId: string, _params: ReserveParams): Promise<SlotHold> {
    const holdId = `hold-${servicioId}-${Date.now()}`;
    const expiraEn = new Date(Date.now() + MINUTOS_TTL * 60 * 1000);
    this.holds.set(holdId, { holdId, servicioId, expiraEn });
    return { holdId, servicioId, expiraEn };
  }

  async releaseSlot(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }

  private calcularNoches(inicio: Date, fin: Date): number {
    const MS_POR_DIA = 1000 * 60 * 60 * 24;
    return Math.round((fin.getTime() - inicio.getTime()) / MS_POR_DIA);
  }

  private tierPorTamano(hotel: Hoteles, params: AvailabilityQuery): SuplementoPorTamanoMascota | undefined {
    const tamano = params.parametrosExtra?.['perroTamano'] ?? params.parametrosExtra?.['tamanoPerro'];
    if (typeof tamano !== 'string') return undefined;
    return (hotel.suplementoPorTamanoMascota ?? []).find((t) => t.tamano === tamano);
  }

  private validarCantidadMascotas(hotel: Hoteles, mascotas: number): void {
    if (hotel.maxMascotasPorReserva && mascotas > hotel.maxMascotasPorReserva) {
      throw new DomainException(
        `Este hotel admite un máximo de ${hotel.maxMascotasPorReserva} mascota(s) por reserva`,
        409,
      );
    }
  }

  private validarPeso(hotel: Hoteles, params: AvailabilityQuery): void {
    if (!hotel.pesoMaximoMascotaKg) return;
    const peso = params.parametrosExtra?.['perroPeso'];
    if (typeof peso !== 'number') return;
    if (peso > hotel.pesoMaximoMascotaKg) {
      throw new DomainException(
        `Este hotel admite mascotas de hasta ${hotel.pesoMaximoMascotaKg}kg`,
        409,
      );
    }
  }

  private validarEspecie(hotel: Hoteles, params: AvailabilityQuery): void {
    if (!hotel.especiesPermitidas?.length) return;
    const especie = params.parametrosExtra?.['perroEspecie'];
    if (typeof especie !== 'string') return;
    if (!hotel.especiesPermitidas.includes(especie)) {
      throw new DomainException('Este hotel no admite la especie de tu mascota', 409);
    }
  }

  private validarRaza(hotel: Hoteles, params: AvailabilityQuery): void {
    if (hotel.razasRestringidas === 'ninguna') return;

    if (hotel.razasRestringidas === 'ppp') {
      const esPPP = params.parametrosExtra?.['perroEsPPP'];
      if (esPPP === true) {
        throw new DomainException('Este hotel no admite razas potencialmente peligrosas', 409);
      }
      return;
    }

    if (hotel.razasRestringidas === 'razas_gigantes') {
      const tamano = params.parametrosExtra?.['perroTamano'];
      if (typeof tamano === 'string' && tamano === TamanoPerro.GIGANTE) {
        throw new DomainException('Este hotel no admite razas gigantes', 409);
      }
      return;
    }

    if (hotel.razasRestringidas === 'especificas') {
      const raza = params.parametrosExtra?.['perroRaza'];
      if (typeof raza === 'string' && hotel.razasEspecificasRestringidas?.includes(raza)) {
        throw new DomainException(`Este hotel no admite la raza "${raza}"`, 409);
      }
    }
  }
}
