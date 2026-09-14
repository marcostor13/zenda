import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DiaAgendaApi, ExcepcionHorarioDto, HorarioDiaDto, HuecosDelDiaRespuestaApi, PrimeraCitaLibreApi,
  fechaYHoraEnZona, tramosDelDia,
} from 'shared';
import { Reserva, ReservaDocument } from './reserva.schema';
import { inicioDeLaReserva, tramoDeLaReserva } from './momento-reserva.util';
import {
  Ocupacion, calcularHuecos, clavesEntre, estadoDelDia, ocupacionesEntre, plazasOcupadas,
} from './huecos.util';
import { BloqueosService, ESTADOS_VIVOS } from '../bloqueos/bloqueos.service';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
/**
 * Tope de días por consulta de agenda. El cliente pide de mes en mes, así que
 * dos meses sobran; sin tope, una petición con un rango absurdo recorrería años
 * de calendario en el servidor.
 */
const MAX_DIAS_AGENDA = 62;
/** Un cierre sin cantidad cierra todo: más plazas de las que tendrá cualquier salón. */
const PLAZAS_CIERRE_TOTAL = Number.MAX_SAFE_INTEGER;

export interface AgendaCalculada {
  readonly dias: DiaAgendaApi[];
  readonly primeraLibre?: PrimeraCitaLibreApi;
}

export interface ServicioConCitas {
  readonly servicioId: string;
  readonly comercioId: string;
  readonly horario?: HorarioDiaDto[];
  readonly excepcionesHorario?: ExcepcionHorarioDto[];
  readonly duracionMin: number;
  readonly capacidad: number;
}

/**
 * Citas libres de un servicio y comprobación de que una hora sigue libre.
 *
 * Las estrategias de los verticales de cita sólo cuentan cupos del día; quien
 * sabe qué horas están cogidas son las reservas vivas y los cierres del
 * comercio, que es lo que se cruza aquí.
 */
@Injectable()
export class HuecosService {
  constructor(
    @InjectModel(Reserva.name) private readonly reservaModel: Model<ReservaDocument>,
    private readonly bloqueosService: BloqueosService,
  ) {}

  async huecosDelDia(servicio: ServicioConCitas, clave: string, ahora = new Date()): Promise<HuecosDelDiaRespuestaApi> {
    const dia = tramosDelDia(servicio.horario, servicio.excepcionesHorario, clave);
    if (dia.estado === 'cerrado') {
      return { soportado: true, estado: 'cerrado', motivo: dia.motivo, duracionMin: servicio.duracionMin, huecos: [] };
    }

    const desde = fechaYHoraEnZona(clave, '00:00');
    const hasta = new Date(desde.getTime() + MS_POR_DIA);
    const ocupaciones = await this.ocupaciones(servicio, desde, hasta);
    const calculo = calcularHuecos({
      clave, dia, duracionMin: servicio.duracionMin, capacidad: servicio.capacidad, ocupaciones, ahora,
    });

    return { soportado: true, ...calculo, duracionMin: servicio.duracionMin };
  }

  /**
   * Cómo está cada día del rango: libre, lleno, cerrado o ya pasado.
   *
   * Se pide el rango entero de una vez y no día a día. Pintar un mes llamando a
   * `huecosDelDia` treinta veces son sesenta consultas —reservas y cierres por
   * cada día—; aquí son **dos**, y el reparto por día se hace en memoria. Es la
   * diferencia entre un calendario que se abre al instante y uno que tarda.
   */
  async agenda(
    servicio: ServicioConCitas, desde: string, hasta: string, ahora = new Date(),
  ): Promise<AgendaCalculada> {
    const claves = clavesEntre(desde, hasta, MAX_DIAS_AGENDA);
    if (!claves.length) return { dias: [] };

    const inicioRango = fechaYHoraEnZona(claves[0], '00:00');
    const finRango = new Date(fechaYHoraEnZona(claves[claves.length - 1], '00:00').getTime() + MS_POR_DIA);
    const ocupaciones = await this.ocupaciones(servicio, inicioRango, finRango);

    const dias: DiaAgendaApi[] = [];
    let primeraLibre: PrimeraCitaLibreApi | undefined;

    for (const clave of claves) {
      const dia = tramosDelDia(servicio.horario, servicio.excepcionesHorario, clave);
      const arranca = fechaYHoraEnZona(clave, '00:00');
      const acaba = new Date(arranca.getTime() + MS_POR_DIA);
      const calculados = calcularHuecos({
        clave, dia, duracionMin: servicio.duracionMin, capacidad: servicio.capacidad,
        ocupaciones: ocupacionesEntre(ocupaciones, arranca, acaba), ahora,
      });

      // Un día entero en el pasado no está lleno: es que ya no llega a tiempo.
      const hayFuturo = acaba.getTime() > ahora.getTime();
      const resumen = estadoDelDia(calculados, hayFuturo);
      // El motivo sólo lo trae el día cerrado; es lo que explica el porqué al cliente.
      const motivo = dia.estado === 'cerrado' ? dia.motivo : undefined;
      dias.push({ fecha: clave, ...resumen, ...(motivo ? { motivo } : {}) });

      if (!primeraLibre && resumen.primeraHora) {
        primeraLibre = { fecha: clave, hora: resumen.primeraHora };
      }
    }

    return { dias, primeraLibre };
  }

  /** ¿Queda plaza para una cita entre `inicio` y `fin`? */
  async hayPlaza(servicio: ServicioConCitas, inicio: Date, fin: Date): Promise<boolean> {
    const ocupaciones = await this.ocupaciones(servicio, inicio, fin);
    return plazasOcupadas(ocupaciones, inicio, fin) < servicio.capacidad;
  }

  private async ocupaciones(servicio: ServicioConCitas, desde: Date, hasta: Date): Promise<Ocupacion[]> {
    const [citas, cierres] = await Promise.all([
      this.citasVivas(servicio, desde, hasta),
      this.bloqueosService.listar(servicio.comercioId, { servicioId: servicio.servicioId, desde, hasta }),
    ]);

    return [
      ...citas,
      ...cierres.map((c) => ({
        inicio: new Date(c.desde), fin: new Date(c.hasta), plazas: c.cantidad ?? PLAZAS_CIERRE_TOTAL,
      })),
    ];
  }

  private async citasVivas(servicio: ServicioConCitas, desde: Date, hasta: Date): Promise<Ocupacion[]> {
    const reservas = await this.reservaModel
      .find({
        comercioId: new Types.ObjectId(servicio.comercioId),
        estado: { $in: ESTADOS_VIVOS },
        servicioId: new Types.ObjectId(servicio.servicioId),
        // Un día antes: las citas antiguas guardaban el día a medianoche UTC, y
        // una cita larga de la víspera puede llegar hasta este tramo.
        fechaInicio: { $gte: new Date(desde.getTime() - MS_POR_DIA), $lt: hasta },
      })
      .select({ fechaInicio: 1, fechaFin: 1, detalle: 1 })
      .lean()
      .exec() as unknown as Array<Parameters<typeof tramoDeLaReserva>[0]>;

    return reservas
      // Lo reservado sin hora (un día suelto) no se sabe a qué hora ocupa: no tapa citas.
      .filter((r) => inicioDeLaReserva(r).conHora)
      .map((r) => ({ ...tramoDeLaReserva(r), plazas: 1 }))
      .filter((o) => o.inicio.getTime() < hasta.getTime() && o.fin.getTime() > desde.getTime());
  }
}
