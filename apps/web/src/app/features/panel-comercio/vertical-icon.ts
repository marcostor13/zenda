import { iconoDeVertical } from '../../shared/verticales/verticales.config';

/**
 * Icono `rs-icon` de una vertical. Delega en `verticales.config`, que es la
 * única fuente de verdad de la UI de cada categoría: este módulo se mantiene
 * porque es el punto de entrada que ya usan los paneles de comercio y admin.
 */
export function iconoVertical(vertical: string): string {
  return iconoDeVertical(vertical);
}
