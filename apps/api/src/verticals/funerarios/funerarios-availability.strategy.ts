import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ModoPrecioRecogida, TipoServicioFunerario, UrgenciaFunerario, URGENCIAS_CON_SUPLEMENTO, VerticalKey,
} from 'shared';
import {
  AvailabilityStrategy,
  AvailabilityQuery,
  AvailabilityResult,
  ReserveParams,
  SlotHold,
} from '../../core/availability/availability.strategy';
import { Servicio, ServicioDocument } from '../../core/catalog/servicio.schema';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { ExtraFunerario, Funerarios, ServicioFunerario } from './funerarios.schema';

const MINUTOS_TTL = 15;

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

/** Lo que el wizard envía en `detalle` y llega aquí como `parametrosExtra`. */
interface PeticionFunerario {
  servicioNombre?: string;
  pesoKg?: number;
  necesitaRecogida?: boolean;
  lugarRecogida?: string;
  distanciaKm?: number;
  zonaRecogida?: string;
  urgencia?: UrgenciaFunerario;
  extras?: string[];
  aceptaSinCenizas?: boolean;
}

/**
 * Vertical Servicios funerarios.
 *
 * Es la única estrategia que devuelve un **precio cerrado completo**: el brief
 * exige que el cliente sepa cuánto paga antes de confirmar, y aquí el importe
 * no es un campo del servicio sino la suma de cuatro cosas —el servicio según
 * el peso del animal, el desplazamiento de recogida, el suplemento de urgencia
 * y los extras elegidos—. Por eso el cálculo vive junto a la disponibilidad y
 * no en el core, que sigue siendo agnóstico al vertical.
 *
 * También es quien dice que no: fuera del radio de recogida, o sin aceptar que
 * una cremación colectiva no devuelve cenizas, la reserva no puede seguir.
 */
@Injectable()
export class FunerariosAvailabilityStrategy implements AvailabilityStrategy {
  readonly vertical = VerticalKey.FUNERARIOS;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
  ) {}

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const empresa = (await this.servicioModel.findById(servicioId).lean().exec()) as
      | (Funerarios & { _id: unknown })
      | null;

    if (!empresa) {
      throw new DomainException('Servicio no encontrado', 404);
    }

    if ((empresa.cuposDisponibles ?? 0) < 1) {
      return {
        disponible: false,
        motivo: 'Esta empresa no tiene huecos libres. Prueba con otra o escríbeles.',
        capacidadRestante: 0,
        metadata: { motivo: 'sin_cupos' },
      };
    }

    const peticion = (params.parametrosExtra ?? {}) as PeticionFunerario;
    const servicio = this.servicioElegido(empresa, peticion.servicioNombre);
    if (!servicio) {
      return {
        disponible: false,
        motivo: 'Esta empresa no ofrece el servicio que has elegido.',
        metadata: { motivo: 'servicio_no_ofrecido' },
      };
    }

    // Ningún cobro sin consentimiento explícito: si el servicio no devuelve las
    // cenizas, el cliente tiene que haberlo aceptado antes de llegar al pago.
    if (!servicio.devuelveCenizas && peticion.aceptaSinCenizas !== true) {
      return {
        disponible: false,
        motivo: 'Debes aceptar que este servicio no incluye la devolución individual de las cenizas.',
        metadata: { motivo: 'falta_aceptacion_cenizas' },
      };
    }

    const recogida = this.evaluarRecogida(empresa, peticion);
    if (recogida.error) {
      return { disponible: false, motivo: recogida.error, metadata: { motivo: recogida.codigo } };
    }

    const urgencia = this.suplementoUrgencia(empresa, peticion.urgencia);
    if (urgencia.error) {
      return { disponible: false, motivo: urgencia.error, metadata: { motivo: 'urgencia_no_ofrecida' } };
    }

    const precioServicio = this.precioSegunPeso(servicio, peticion.pesoKg);
    const extras = this.precioExtras(empresa, peticion.extras);
    const total = precioServicio + recogida.precio + urgencia.precio + extras.precio;

    return {
      disponible: true,
      capacidadRestante: empresa.cuposDisponibles - 1,
      precioCalculado: Math.round(total * 100) / 100,
      metadata: {
        servicio: servicio.nombre,
        tipo: servicio.tipo,
        precioServicio,
        precioRecogida: recogida.precio,
        suplementoUrgencia: urgencia.precio,
        precioExtras: extras.precio,
        extras: extras.nombres,
        devuelveCenizas: servicio.devuelveCenizas,
        tiempoEstimadoHoras: servicio.tiempoEstimadoHoras,
      },
    };
  }

  async reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold> {
    const disponibilidad = await this.checkAvailability(servicioId, {
      fechaInicio: params.fechaInicio,
      fechaFin: params.fechaFin,
      cantidad: params.cantidad,
      parametrosExtra: params.parametrosExtra,
    });

    if (!disponibilidad.disponible) {
      throw new DomainException(disponibilidad.motivo ?? 'La empresa no puede atender ese servicio', 409);
    }

    const hold: HoldEntry = {
      holdId: `fun-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      servicioId,
      expiraEn: new Date(Date.now() + MINUTOS_TTL * 60 * 1000),
    };
    this.holds.set(hold.holdId, hold);

    return { ...hold, metadata: disponibilidad.metadata };
  }

  async releaseSlot(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }

  /** El servicio pedido por nombre; sin nombre, el primero activo del catálogo. */
  private servicioElegido(empresa: Funerarios, nombre?: string): ServicioFunerario | undefined {
    const activos = (empresa.serviciosFunerarios ?? []).filter((s) => s.activo !== false);
    if (!nombre) return activos[0];
    return activos.find((s) => s.nombre === nombre);
  }

  /**
   * Precio del servicio para el peso declarado: gana el primer tramo cuyo
   * límite lo cubre. Sin tramos —o con un peso por encima del último— se cobra
   * el precio base, que es lo que la empresa declara como precio único.
   */
  private precioSegunPeso(servicio: ServicioFunerario, pesoKg?: number): number {
    const tramos = [...(servicio.tramosPeso ?? [])].sort((a, b) => a.hastaKg - b.hastaKg);
    if (!tramos.length || pesoKg == null) return servicio.precioBase ?? 0;

    const tramo = tramos.find((t) => pesoKg <= t.hastaKg);
    return tramo ? tramo.precio : (tramos[tramos.length - 1].precio ?? servicio.precioBase ?? 0);
  }

  /**
   * Desplazamiento de recogida. Fuera del radio declarado no se devuelve un
   * precio alto: se corta la reserva, que es lo que pide el brief.
   */
  private evaluarRecogida(
    empresa: Funerarios,
    peticion: PeticionFunerario,
  ): { precio: number; error?: string; codigo?: string } {
    if (!peticion.necesitaRecogida) return { precio: 0 };

    if (!empresa.ofreceRecogida) {
      return { precio: 0, error: 'Esta empresa no ofrece recogida.', codigo: 'sin_recogida' };
    }

    const lugares = empresa.lugaresRecogida ?? [];
    if (peticion.lugarRecogida && lugares.length && !lugares.includes(peticion.lugarRecogida)) {
      return { precio: 0, error: 'Esta empresa no recoge desde ese lugar.', codigo: 'lugar_no_cubierto' };
    }

    const distancia = peticion.distanciaKm;
    if (distancia != null && distancia > (empresa.radioRecogidaKm ?? 0)) {
      return {
        precio: 0,
        error: `La dirección queda fuera del radio de recogida (${empresa.radioRecogidaKm} km).`,
        codigo: 'fuera_de_cobertura',
      };
    }

    if (empresa.modoPrecioRecogida === ModoPrecioRecogida.POR_KM) {
      return { precio: Math.round((empresa.precioRecogidaPorKm ?? 0) * (distancia ?? 0) * 100) / 100 };
    }

    if (empresa.modoPrecioRecogida === ModoPrecioRecogida.POR_ZONA) {
      const zona = (empresa.zonasRecogida ?? []).find((z) => z.nombre === peticion.zonaRecogida);
      if (!zona) {
        return {
          precio: 0,
          error: 'Esa zona no está entre las que cubre la empresa.',
          codigo: 'fuera_de_cobertura',
        };
      }
      return { precio: zona.precio ?? 0 };
    }

    return { precio: empresa.precioRecogida ?? 0 };
  }

  /** Suplemento de urgencia; sólo lo cobran las urgencias reales, no una fecha elegida. */
  private suplementoUrgencia(
    empresa: Funerarios,
    urgencia?: UrgenciaFunerario,
  ): { precio: number; error?: string } {
    if (!urgencia || !URGENCIAS_CON_SUPLEMENTO.includes(urgencia)) return { precio: 0 };

    if (!empresa.servicioUrgente && !empresa.atiende24h) {
      return { precio: 0, error: 'Esta empresa no atiende servicios urgentes.' };
    }
    return { precio: empresa.suplementoUrgencia ?? 0 };
  }

  /** Extras elegidos por el cliente, ignorando los que la empresa ha desactivado. */
  private precioExtras(
    empresa: Funerarios,
    elegidos?: string[],
  ): { precio: number; nombres: string[] } {
    if (!elegidos?.length) return { precio: 0, nombres: [] };

    const disponibles: ExtraFunerario[] = (empresa.extras ?? []).filter((e) => e.activo !== false);
    const aplicados = disponibles.filter((e) => elegidos.includes(e.nombre));

    return {
      precio: aplicados.reduce((total, e) => total + (e.precio ?? 0), 0),
      nombres: aplicados.map((e) => e.nombre),
    };
  }
}

/** Servicios que nunca devuelven cenizas individuales, para avisar en el wizard. */
export const TIPOS_SIN_CENIZAS: readonly TipoServicioFunerario[] = [
  TipoServicioFunerario.CREMACION_COLECTIVA,
];
