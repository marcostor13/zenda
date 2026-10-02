/**
 * Número de microchip según ISO 11784/11785: 15 dígitos (código de país o de
 * fabricante + número nacional). Es el estándar obligatorio en la UE para el
 * pasaporte de animales de compañía.
 */
export const MICROCHIP_DIGITOS = 15;

/** Exactamente 15 dígitos. */
export const MICROCHIP_REGEX = /^\d{15}$/;

/**
 * Lo mismo, pero admitiendo la cadena vacía: el microchip es opcional y el
 * dueño tiene que poder borrarlo de la ficha.
 */
export const MICROCHIP_OPCIONAL_REGEX = /^(\d{15})?$/;

/** Quita espacios, guiones y puntos: los lectores y las cartillas lo agrupan de formas distintas. */
export function normalizarMicrochip(valor: string): string {
  return valor.replace(/[\s.-]/g, '');
}

export function esMicrochipValido(valor: string): boolean {
  return MICROCHIP_REGEX.test(normalizarMicrochip(valor));
}
