import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExcepcionHorarioDto, HorarioDiaDto, HuecosDelDiaRespuestaApi, fechaYHoraEnZona, tramosDelDia } from 'shared';
import { Reserva, ReservaDocument } from './reserva.schema';
import { inicioDeLaReserva, tramoDeLaReserva } from './momento-reserva.util';
import { Ocupacion, calcularHuecos, plazasOcupadas } from './huecos.util';
import { BloqueosService, ESTADOS_VIVOS } from '../bloqueos/bloqueos.service';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
/** Un cierre sin cantidad cierra todo: más plazas de las que tendrá cualquier salón. */
const PLAZAS_CIERRE_TOTAL = Number.MAX_SAFE_INTEGER;

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
