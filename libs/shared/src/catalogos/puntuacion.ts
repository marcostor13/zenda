/**
 * Etiqueta de la nota media de un servicio, al estilo de Booking («Fabuloso 4,6»).
 *
 * Las reseñas se puntúan de 1 a 5, así que los umbrales van en esa escala. Antes
 * se usaban los de Booking sobre 10 (≥9, ≥8…) con una media sobre 5, y todos los
 * servicios salían «Correcto».
 */
export const ESCALA_PUNTUACION = 5;

/**
 * Rótulo de un servicio que nadie ha valorado todavía. Sin reseñas no hay nota:
 * enseñar «0 · Correcto» lo hacía parecer valorado, y mal.
 */
export const ETIQUETA_SIN_VALORACIONES = 'Sin valoraciones';

const UMBRALES_PUNTUACION: ReadonlyArray<readonly [number, string]> = [
  [4.7, 'Excepcional'],
  [4.4, 'Fabuloso'],
  [4.0, 'Muy bueno'],
  [3.5, 'Bueno'],
];

/**
 * ¿Hay valoraciones de verdad detrás de la nota? Manda el contador: una nota
 * sin reseñas que la sostengan es un dato heredado o un valor por defecto.
 * Sin contador (`undefined`) se mira la nota, para no esconder datos viejos.
 */
export function tieneValoraciones(nota: number | null | undefined, numResenas?: number | null): boolean {
  if (numResenas != null) return numResenas > 0;
  return Number(nota) > 0;
}

/**
 * Texto de la etiqueta; el front lo pasa por `| t` como cualquier otra cadena.
 * Con `numResenas` a 0 (o nota 0) devuelve «Sin valoraciones», nunca «Correcto».
 */
export function etiquetaPuntuacion(nota: number, numResenas?: number | null): string {
  if (!tieneValoraciones(nota, numResenas)) return ETIQUETA_SIN_VALORACIONES;
  const umbral = UMBRALES_PUNTUACION.find(([minimo]) => nota >= minimo);
  return umbral ? umbral[1] : 'Correcto';
}
