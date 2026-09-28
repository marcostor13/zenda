/**
 * Etiqueta de la nota media de un servicio, al estilo de Booking («Fabuloso 4,6»).
 *
 * Las reseñas se puntúan de 1 a 5, así que los umbrales van en esa escala. Antes
 * se usaban los de Booking sobre 10 (≥9, ≥8…) con una media sobre 5, y todos los
 * servicios salían «Correcto».
 */
export const ESCALA_PUNTUACION = 5;

const UMBRALES_PUNTUACION: ReadonlyArray<readonly [number, string]> = [
  [4.7, 'Excepcional'],
  [4.4, 'Fabuloso'],
  [4.0, 'Muy bueno'],
  [3.5, 'Bueno'],
];

/** Texto de la etiqueta; el front lo pasa por `| t` como cualquier otra cadena. */
export function etiquetaPuntuacion(nota: number): string {
  const umbral = UMBRALES_PUNTUACION.find(([minimo]) => nota >= minimo);
  return umbral ? umbral[1] : 'Correcto';
}
