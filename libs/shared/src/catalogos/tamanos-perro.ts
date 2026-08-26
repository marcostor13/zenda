import { TamanoPerro } from '../enums/perro.enum';

export interface TramoTamanoPerro {
  valor: TamanoPerro;
  /** Nombre a secas: "Mini". */
  nombre: string;
  /** Con el tramo de peso: "Mini (0-5 kg)". Es lo que se enseña al elegir. */
  etiqueta: string;
}

/**
 * La escala de tamaños de perro, **de menor a mayor**. Fuente única.
 *
 * Estaba copiada en cada desplegable, y las copias se habían desincronizado:
 * el paso 1 de alojamiento se dejaba fuera `mini` y usaba tramos de peso
 * propios (25-45 kg, +45 kg). Con un espacio que admitía hasta "mini" no había
 * ninguna opción elegible, así que la reserva se rechazaba siempre y el cliente
 * no tenía forma de arreglarlo desde la pantalla.
 *
 * El orden importa: es el que usan los verticales para decidir si un perro cabe
 * en un espacio (`indexOf(perro) <= indexOf(maximo)`).
 */
export const TAMANOS_PERRO: readonly TramoTamanoPerro[] = [
  { valor: TamanoPerro.MINI,    nombre: 'Mini',    etiqueta: 'Mini (0-5 kg)' },
  { valor: TamanoPerro.PEQUENO, nombre: 'Pequeño', etiqueta: 'Pequeño (5-10 kg)' },
  { valor: TamanoPerro.MEDIANO, nombre: 'Mediano', etiqueta: 'Mediano (10-25 kg)' },
  { valor: TamanoPerro.GRANDE,  nombre: 'Grande',  etiqueta: 'Grande (25-40 kg)' },
  { valor: TamanoPerro.GIGANTE, nombre: 'Gigante', etiqueta: 'Gigante (+40 kg)' },
];

/** Sólo los valores, en orden. Para comparar "cabe / no cabe". */
export const ORDEN_TAMANOS_PERRO: readonly string[] = TAMANOS_PERRO.map((t) => t.valor);

/**
 * Nombre legible de un tamaño. Devuelve el propio valor si no se reconoce, para
 * que un dato viejo se siga leyendo en vez de desaparecer del mensaje.
 */
export const nombreTamanoPerro = (valor: string): string =>
  TAMANOS_PERRO.find((t) => t.valor === valor)?.nombre ?? valor;

/** Etiqueta con tramo de peso. Misma regla de respaldo que `nombreTamanoPerro`. */
export const etiquetaTamanoPerro = (valor: string): string =>
  TAMANOS_PERRO.find((t) => t.valor === valor)?.etiqueta ?? valor;

/**
 * ¿Cabe un perro de `tamano` en un espacio que admite hasta `maximo`?
 *
 * Un tamaño desconocido o ausente no bloquea: se reserva igual y el comercio lo
 * comprueba a la llegada. Es preferible a rechazar por un dato que el cliente
 * quizá ni ha declarado.
 */
export const cabeEnTamano = (tamano?: string, maximo?: string): boolean => {
  if (!maximo || !tamano) return true;

  const indiceTamano = ORDEN_TAMANOS_PERRO.indexOf(tamano);
  const indiceMaximo = ORDEN_TAMANOS_PERRO.indexOf(maximo);
  if (indiceTamano === -1 || indiceMaximo === -1) return true;

  return indiceTamano <= indiceMaximo;
};
