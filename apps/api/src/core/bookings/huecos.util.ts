import {
  EstadoDiaAgenda, EstadoHuecosDia, HuecoCitaApi, TramoMinutos, TramosDelDia,
  fechaYHoraEnZona, horaDeMinutos,
} from 'shared';

const MS_POR_MINUTO = 60_000;

/** Horario supuesto cuando el comercio aún no ha puesto el suyo. */
export const HORARIO_POR_DEFECTO: readonly TramoMinutos[] = [[9 * 60, 20 * 60]];

/** Algo que ya ocupa tiempo del servicio: una cita o un cierre parcial. */
export interface Ocupacion {
  readonly inicio: Date;
  readonly fin: Date;
  /** Cuántas plazas quita a la vez. Una cita, una; un cierre total, todas. */
  readonly plazas: number;
}

export interface CalculoHuecos {
  /** Día del comercio, `YYYY-MM-DD`. */
  readonly clave: string;
  readonly dia: TramosDelDia;
  readonly duracionMin: number;
  /** Citas que caben a la vez en la misma hora (mesas, consultas). */
  readonly capacidad: number;
  readonly ocupaciones: readonly Ocupacion[];
  readonly ahora: Date;
}

export interface HuecosCalculados {
  readonly estado: EstadoHuecosDia;
  readonly motivo?: string;
  readonly huecos: HuecoCitaApi[];
}

/**
 * Cada cuánto empieza una cita. Las citas de media hora o más se ofrecen cada
 * 30 minutos —así un salón no enseña 40 botones—; las cortas, cada 15.
 */
export function pasoDeHuecos(duracionMin: number): number {
  return duracionMin < 30 ? 15 : 30;
}

/**
 * Citas posibles de un día y si están libres.
 *
 * Una cita cabe si empieza y acaba dentro de un tramo del horario, no ha pasado
 * y, durante toda su duración, lo ya ocupado deja al menos una plaza libre.
 */
export function calcularHuecos(calculo: CalculoHuecos): HuecosCalculados {
  const { dia } = calculo;
  if (dia.estado === 'cerrado') return { estado: 'cerrado', motivo: dia.motivo, huecos: [] };

  const tramos = dia.estado === 'abierto' ? dia.tramos : HORARIO_POR_DEFECTO;
  const paso = pasoDeHuecos(calculo.duracionMin);
  const huecos: HuecoCitaApi[] = [];

  for (const [abre, cierra] of tramos) {
    for (let minuto = abre; minuto + calculo.duracionMin <= cierra; minuto += paso) {
      const hora = horaDeMinutos(minuto);
      const inicio = fechaYHoraEnZona(calculo.clave, hora);
      const fin = new Date(inicio.getTime() + calculo.duracionMin * MS_POR_MINUTO);
      const disponible = inicio.getTime() > calculo.ahora.getTime()
        && plazasOcupadas(calculo.ocupaciones, inicio, fin) < calculo.capacidad;
      huecos.push({ hora, inicio: inicio.toISOString(), disponible });
    }
  }

  return { estado: dia.estado, huecos };
}

/**
 * Máximo de plazas ocupadas a la vez dentro de `[inicio, fin)`. No basta con
 * sumar lo que solapa: dos citas de 10:00 y 10:30 en una cita de una hora no
 * coinciden entre sí y sólo ocupan una plaza en cada momento.
 */
export function plazasOcupadas(ocupaciones: readonly Ocupacion[], inicio: Date, fin: Date): number {
  const solapan = ocupaciones.filter((o) => o.inicio.getTime() < fin.getTime() && o.fin.getTime() > inicio.getTime());
  if (!solapan.length) return 0;

  // El pico sólo puede cambiar al empezar una ocupación (o al empezar la cita).
  const momentos = [inicio.getTime(), ...solapan.map((o) => o.inicio.getTime())]
    .filter((t) => t >= inicio.getTime() && t < fin.getTime());

  return Math.max(...momentos.map((t) => solapan
    .filter((o) => o.inicio.getTime() <= t && o.fin.getTime() > t)
    .reduce((total, o) => total + o.plazas, 0)));
}

/** Días `YYYY-MM-DD` de `desde` a `hasta`, ambos incluidos, como mucho `max`. */
export function clavesEntre(desde: string, hasta: string, max: number): string[] {
  const claves: string[] = [];
  let actual = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);

  while (actual <= fin && claves.length < max) {
    claves.push(new Date(actual).toISOString().slice(0, 10));
    actual += 24 * 60 * MS_POR_MINUTO;
  }

  return claves;
}

/** Lo que solapa con `[desde, hasta)`. Acotar por día evita repasar el mes entero en cada hueco. */
export function ocupacionesEntre(
  ocupaciones: readonly Ocupacion[], desde: Date, hasta: Date,
): Ocupacion[] {
  return ocupaciones.filter(
    (o) => o.inicio.getTime() < hasta.getTime() && o.fin.getTime() > desde.getTime(),
  );
}

/**
 * Cómo queda un día una vez calculados sus huecos.
 *
 * `cerrado` y `completo` se separan porque al cliente le sirven para cosas
 * distintas: uno le dice que pruebe otro día, el otro que pruebe otra hora del
 * mismo. `pasado` es el día que ya no se puede coger aunque el comercio abra.
 */
export function estadoDelDia(
  calculados: HuecosCalculados, hayFuturo: boolean,
): { estado: EstadoDiaAgenda; huecosLibres: number; primeraHora?: string } {
  if (calculados.estado === 'cerrado') return { estado: 'cerrado', huecosLibres: 0 };

  const libres = calculados.huecos.filter((h) => h.disponible);
  if (libres.length) return { estado: 'libre', huecosLibres: libres.length, primeraHora: libres[0].hora };

  // Sin huecos futuros el día no está lleno: simplemente ya pasó su hora.
  return { estado: hayFuturo ? 'completo' : 'pasado', huecosLibres: 0 };
}
