import { TipoPelo } from '../enums/perro.enum';

/**
 * Manto del perro: dos conceptos distintos que la ficha antes mezclaba.
 *
 * - **Tipo de manto** (`tipoPelo`): cómo es el pelo por naturaleza. No cambia;
 *   la peluquería lo usa para saber qué técnica, tiempo y material hacen falta.
 * - **Estado del manto** (`estadoManto`): cómo está hoy. Cambia entre visitas y
 *   es lo que dispara suplementos (deslanado, desenredado).
 */

/** Etiqueta legible de cada tipo de manto, en el orden en que se ofrece. */
export const TIPO_MANTO_LABELS: Readonly<Record<TipoPelo, string>> = {
  [TipoPelo.CORTO]: 'Corto',
  [TipoPelo.MEDIO]: 'Medio',
  [TipoPelo.LARGO]: 'Largo',
  [TipoPelo.DURO]: 'Duro',
  [TipoPelo.RIZADO]: 'Rizado',
  [TipoPelo.DOBLE_CAPA]: 'Doble capa',
  [TipoPelo.SEDOSO]: 'Sedoso',
  [TipoPelo.CORDADO]: 'Cordado (rastas)',
  [TipoPelo.SIN_PELO]: 'Sin pelo',
};

/** Estados del manto que distingue una peluquería canina. */
export enum EstadoManto {
  NORMAL = 'normal',
  NUDOS_LEVES = 'nudos_leves',
  ENREDADO = 'enredado',
  MUDA = 'muda',
  SUCIO = 'sucio',
  PIEL_SENSIBLE = 'piel_sensible',
}

export const ESTADO_MANTO_LABELS: Readonly<Record<EstadoManto, string>> = {
  [EstadoManto.NORMAL]: 'Normal, bien cuidado',
  [EstadoManto.NUDOS_LEVES]: 'Con algunos nudos',
  [EstadoManto.ENREDADO]: 'Muy enredado o apelmazado',
  [EstadoManto.MUDA]: 'En muda (suelta mucho pelo)',
  [EstadoManto.SUCIO]: 'Muy sucio',
  [EstadoManto.PIEL_SENSIBLE]: 'Piel sensible o irritada',
};

/** Etiqueta del tipo de manto; si llega una clave desconocida se devuelve tal cual. */
export function nombreTipoManto(valor: string): string {
  return TIPO_MANTO_LABELS[valor as TipoPelo] ?? valor;
}

/**
 * Etiqueta del estado del manto. Antes era texto libre, así que una ficha
 * antigua puede traer cualquier frase: esa se devuelve tal cual.
 */
export function nombreEstadoManto(valor: string): string {
  return ESTADO_MANTO_LABELS[valor as EstadoManto] ?? valor;
}

/** ¿Es una de las claves del catálogo (y no un texto libre heredado)? */
export function esEstadoMantoConocido(valor: string): valor is EstadoManto {
  return (Object.values(EstadoManto) as string[]).includes(valor);
}
