import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VerticalKey, cabeEnTamano, etiquetaTamanoPerro } from 'shared';
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
import { localizarUnidad } from '../../core/catalog/unidad-reservable';
import { DomainException } from '../../shared/exceptions/domain.exception';
import { Alojamiento, EspacioCanino } from './alojamiento.schema';

const MINUTOS_TTL = 15;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

interface HoldEntry {
  holdId: string;
  servicioId: string;
  expiraEn: Date;
}

@Injectable()
export class AlojamientoAvailabilityStrategy implements AvailabilityStrategy, CalendarioStrategy {
  readonly vertical = VerticalKey.ALOJAMIENTO;

  private readonly holds = new Map<string, HoldEntry>();

  constructor(
    @InjectModel(Servicio.name) private readonly servicioModel: Model<ServicioDocument>,
    private readonly ocupacion: OcupacionRepository,
  ) {}

  /**
   * Noche a noche, cuántas plazas quedan libres en el rango pedido.
   *
   * No hay una colección de calendario: la ocupación se deriva de las reservas
   * vivas del servicio. Es la misma cuenta que hace `checkAvailability`, y tiene
   * que serlo — si el calendario pintase una noche libre que luego la reserva
   * rechaza, el cliente volvería a chocar al final, que es justo lo que se
   * quería quitar de en medio.
   */
  async calendario(servicioId: string, rango: RangoCalendario): Promise<DiaCalendario[]> {
    const alojamiento = await this.servicioModel.findById(servicioId).lean().exec() as (Alojamiento & { _id: unknown }) | null;

    if (!alojamiento) {
      throw new DomainException('Alojamiento no encontrado', 404);
    }

    const localizado = localizarUnidad(alojamiento.espacios ?? [], rango.espacioId);
    const plazas = localizado?.unidad.cantidad ?? 0;

    const ocupadas = await this.ocupacion.nochesOcupadas({
      servicioId,
      desde: rango.desde,
      hasta: rango.hasta,
      // El id público es el que las reservas guardan en `detalle.espacioId`.
      espacioId: localizado?.idPublico,
    });

    const hoy = claveDia(new Date());
    const dias: DiaCalendario[] = [];

    for (
      let dia = inicioDelDia(rango.desde);
      dia.getTime() <= inicioDelDia(rango.hasta).getTime();
      dia = new Date(dia.getTime() + MS_POR_DIA)
    ) {
      const fecha = claveDia(dia);
      const libres = Math.max(0, plazas - (ocupadas.get(fecha) ?? 0));
      dias.push({ fecha, disponible: libres > 0 && fecha >= hoy, plazasLibres: libres });
    }

    return dias;
  }

  async checkAvailability(servicioId: string, params: AvailabilityQuery): Promise<AvailabilityResult> {
    const alojamiento = await this.servicioModel.findById(servicioId).lean().exec() as (Alojamiento & { _id: unknown }) | null;

    if (!alojamiento) {
      throw new DomainException('Alojamiento no encontrado', 404);
    }

    if (!params.fechaFin) {
      throw new DomainException('Se requiere fechaFin para reservar alojamiento canino', 400);
    }

    const noches = this.calcularNoches(params.fechaInicio, params.fechaFin);

    if (noches <= 0) {
      return { disponible: false, motivo: 'La fecha de salida tiene que ser posterior a la de entrada.' };
    }

    const localizado = this.espacioSolicitado(alojamiento, params);

    if (!localizado) {
      return { disponible: false, motivo: 'Este alojamiento no tiene ningún espacio publicado para reservar.' };
    }

    const espacio = localizado.unidad;

    if (espacio.cantidad <= 0) {
      return { disponible: false, motivo: 'No quedan plazas libres en este alojamiento para las fechas elegidas.' };
    }

    // `espacio.cantidad` son las unidades que tiene la residencia, no las que
    // están libres esas noches. Sin esta comprobación dos clientes podían
    // reservar la misma suite para las mismas fechas y el conflicto no se veía
    // hasta la llegada.
    const nocheLlena = await this.primeraNocheLlena(servicioId, localizado, params);
    if (nocheLlena) {
      return {
        disponible: false,
        motivo: `No quedan plazas libres la noche del ${this.enCastellano(nocheLlena)}. Prueba con otras fechas.`,
      };
    }

    this.validarTamano(espacio, params);
    this.validarCompatibilidadSocial(alojamiento, params);
    this.validarConductaRiesgo(alojamiento, params);

    const perros = Math.max(1, params.cantidad ?? 1);
    const extras = this.calcularExtras(alojamiento, params);

    return {
      disponible: true,
      capacidadRestante: espacio.cantidad,
      precioCalculado: espacio.precioNoche * noches * perros + extras,
      metadata: { noches, perros, extras },
    };
  }

  /**
   * Suma el precio de los `serviciosAdicionales` configurados por el comercio y
   * elegidos por el cliente (HU-15.1/15.2) — se identifican por nombre, no por id,
   * porque el schema no tiene id estable por servicio adicional.
   */
  private calcularExtras(alojamiento: Alojamiento, params: AvailabilityQuery): number {
    const seleccionados = params.parametrosExtra?.['extras'];
    if (!Array.isArray(seleccionados) || seleccionados.length === 0) return 0;
    const disponibles = alojamiento.serviciosAdicionales ?? [];
    return seleccionados.reduce((suma: number, nombre) => {
      const extra = disponibles.find((e) => e.nombre === nombre);
      return suma + (extra?.precio ?? 0);
    }, 0);
  }

  /** Usa el espacio elegido por el cliente (`espacioId`); si no se indica, el primero con cupo. */
  private espacioSolicitado(
    alojamiento: Alojamiento,
    params: AvailabilityQuery,
  ): { unidad: EspacioCanino; idPublico: string } | undefined {
    const espacioId = params.parametrosExtra?.['espacioId'];
    return localizarUnidad(
      alojamiento.espacios ?? [],
      typeof espacioId === 'string' && espacioId ? espacioId : undefined,
    );
  }

  /**
   * Bloquea la reserva si el perro supera el `tamanoMaxPerro` declarado por el espacio.
   * Un espacio sin `tamanoMaxPerro` admite cualquier tamaño (docs/mejora_servicios.md §2.1).
   */
  private validarTamano(espacio: EspacioCanino, params: AvailabilityQuery): void {
    if (!espacio.tamanoMaxPerro) return;
    const perroTamano = params.parametrosExtra?.['perroTamano'] ?? params.parametrosExtra?.['tamanoPerro'];
    if (typeof perroTamano !== 'string') return;

    if (cabeEnTamano(perroTamano, espacio.tamanoMaxPerro)) return;

    // Con la etiqueta, no con la clave: "mini" a secas no le dice al cliente
    // ni qué tamaño es ni si su perro entra.
    throw new DomainException(
      `Este espacio solo admite perros de tamaño ${etiquetaTamanoPerro(espacio.tamanoMaxPerro)} o menor. `
      + `Elige otro espacio de este alojamiento, o revisa el tamaño de tu perro.`,
      409,
    );
  }

  /**
   * Bloquea la reserva si el perfil de compatibilidad social declarado no está entre los
   * admitidos por la residencia. Un array vacío/ausente admite cualquier perfil.
   */
  private validarCompatibilidadSocial(alojamiento: Alojamiento, params: AvailabilityQuery): void {
    if (!alojamiento.compatibilidadSocialAdmitida?.length) return;
    const compatibilidad = params.parametrosExtra?.['compatibilidadSocial'];
    if (typeof compatibilidad !== 'string' || !compatibilidad) return;

    if (!alojamiento.compatibilidadSocialAdmitida.includes(compatibilidad)) {
      throw new DomainException(
        'Esta residencia no admite el perfil de compatibilidad social indicado para tu perro',
        409,
      );
    }
  }

  /**
   * Bloquea la reserva si el perro presenta una conducta de riesgo que esta residencia
   * marcó como no admitida (Ref. RES5). Un array vacío/ausente admite cualquier conducta.
   */
  private validarConductaRiesgo(alojamiento: Alojamiento, params: AvailabilityQuery): void {
    const noAdmitidas = alojamiento.conductasNoAdmitidas ?? [];
    if (!noAdmitidas.length) return;

    const extra = params.parametrosExtra ?? {};
    const CONDUCTA_PERRO: Record<string, unknown> = {
      agresividad: extra['perroProtectorRecursos'] || extra['perroReactividadCorrea'],
      ansiedad_extrema: extra['perroAnsiedadSeparacion'],
      tendencia_escapar: extra['perroTendenciaEscapar'],
      destructivo: extra['perroDestructivoEnSoledad'],
    };

    const conductaDetectada = noAdmitidas.find((c) => !!CONDUCTA_PERRO[c]);
    if (conductaDetectada) {
      throw new DomainException(
        'Esta residencia no admite perros con esta conducta de riesgo. Contacta con el negocio antes de reservar.',
        409,
      );
    }
  }

  async reserveSlot(servicioId: string, params: ReserveParams): Promise<SlotHold> {
    const holdId = `hold-${servicioId}-${Date.now()}`;
    const expiraEn = new Date(Date.now() + MINUTOS_TTL * 60 * 1000);

    this.holds.set(holdId, { holdId, servicioId, expiraEn });

    return { holdId, servicioId, expiraEn };
  }

  async releaseSlot(holdId: string): Promise<void> {
    this.holds.delete(holdId);
  }

  /** Primera noche del rango sin plaza libre, o null si caben todas. */
  private async primeraNocheLlena(
    servicioId: string,
    localizado: { unidad: EspacioCanino; idPublico: string },
    params: AvailabilityQuery,
  ): Promise<string | null> {
    if (!params.fechaFin) return null;

    const ocupadas = await this.ocupacion.nochesOcupadas({
      servicioId,
      desde: params.fechaInicio,
      hasta: params.fechaFin,
      espacioId: localizado.idPublico,
    });

    return nochesDe(params.fechaInicio, params.fechaFin)
      .find((noche) => (ocupadas.get(noche) ?? 0) >= localizado.unidad.cantidad) ?? null;
  }

  /** `2026-09-01` → `1 de septiembre`, que es como se lee una fecha en un aviso. */
  private enCastellano(fecha: string): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return `${dia} de ${MESES[mes - 1]} de ${anio}`;
  }

  private calcularNoches(inicio: Date, fin: Date): number {
    return Math.round((fin.getTime() - inicio.getTime()) / MS_POR_DIA);
  }
}
