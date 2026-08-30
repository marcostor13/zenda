import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const DIAS_SEMANA = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

/**
 * Horario semanal de atención.
 *
 * Cuelga del **servicio**, no del comercio: un mismo negocio puede tener la
 * peluquería abierta de tarde y la residencia canina con entradas sólo por la
 * mañana, y con un único horario de empresa el cliente veía un dato que no era
 * el del servicio que estaba reservando.
 */
export class HorarioDiaDto {
  @IsIn(DIAS_SEMANA as unknown as string[])
  dia!: string;

  /** Primer tramo del día. */
  @IsOptional() @IsString() abre?: string;
  @IsOptional() @IsString() cierra?: string;

  /**
   * Segundo tramo, para la jornada partida. El esquema y el formulario del panel
   * ya lo contemplaban (TCK-8028: "muchos negocios cierran a mediodía"), pero
   * faltaba declararlo aquí, así que guardar el horario devolvía siempre 400
   * "property abre2 should not exist" — los catorce días de la semana a la vez.
   */
  @IsOptional() @IsString() abre2?: string;
  @IsOptional() @IsString() cierra2?: string;

  @IsBoolean()
  cerrado!: boolean;
}

/** Festivo, vacaciones o cierre puntual que se salta el horario semanal. */
export class ExcepcionHorarioDto {
  /** Fecha en formato ISO corto (YYYY-MM-DD). */
  @IsString()
  fecha!: string;

  @IsOptional() @IsString() motivo?: string;

  @IsBoolean()
  cerrado!: boolean;

  @IsOptional() @IsString() abre?: string;
  @IsOptional() @IsString() cierra?: string;
}

export const DIAS_LABORABLES: readonly DiaSemana[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes',
];

/** Un mismo horario aplicado a varios días. */
export interface TramoSemanal {
  readonly dias: readonly DiaSemana[];
  readonly abre: string;
  readonly cierra: string;
  /** Segundo tramo, para la jornada partida. */
  readonly abre2?: string;
  readonly cierra2?: string;
}

/**
 * Construye la semana completa a partir de los tramos que se abren. Los días que
 * no aparezcan en ningún tramo salen cerrados: la semana siempre tiene sus siete
 * días, porque un día ausente y un día cerrado no significan lo mismo para quien
 * lee la ficha.
 */
export function horarioSemanal(...tramos: readonly TramoSemanal[]): HorarioDiaDto[] {
  return DIAS_SEMANA.map((dia) => {
    const tramo = tramos.find((t) => t.dias.includes(dia));
    if (!tramo) return { dia, cerrado: true };
    return {
      dia,
      cerrado: false,
      abre: tramo.abre,
      cierra: tramo.cierra,
      abre2: tramo.abre2,
      cierra2: tramo.cierra2,
    };
  });
}
