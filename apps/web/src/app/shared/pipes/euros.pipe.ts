import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

/*
 * Los datos de `es` se registran aquí, al importar el pipe, y no en el arranque
 * de la aplicación: así el formato de los importes no depende de que alguien se
 * acuerde de configurarlo, y los tests que usan el pipe sueltos también lo
 * tienen. `registerLocaleData` es idempotente, así que repetirlo no cuesta.
 */
registerLocaleData(localeEs);

/**
 * Formato único de los importes en euros de toda la aplicación.
 *
 * Existe porque hasta ahora cada plantilla lo decidía por su cuenta: unas
 * escribían `€24`, otras `24 €` y otras `€ 24,00`, así que la misma pantalla
 * podía contradecirse consigo misma. El cliente pidió el símbolo detrás
 * (feedback 2026-08-20), que además es como se escribe en España.
 */

/**
 * Los importes se formatean siempre en español, sin tocar el `LOCALE_ID` de la
 * aplicación: cambiarlo afectaría a cualquier número (cantidades, valoraciones,
 * kilómetros) y aquí sólo se trata del dinero.
 */
const LOCALE_IMPORTES = 'es';

/**
 * Espacio duro entre la cifra y el símbolo. Con un espacio normal, un importe
 * al final de una línea estrecha puede partirse y dejar el «€» solo en la
 * siguiente.
 */
const ESPACIO_DURO = ' ';

/** Lo que se pinta cuando no hay importe: `NaN €` no es una respuesta. */
const SIN_IMPORTE = '—';

/**
 * Convierte un importe en su representación en euros: `24 €`, `1.234,50 €`.
 *
 * `null`, `undefined` y lo que no sea un número devuelven un guion: un precio
 * que todavía no ha llegado del API no debe pintarse como si valiera cero.
 */
export function euros(valor: number | string | null | undefined, digitos = '1.0-2'): string {
  if (valor === null || valor === undefined || valor === '') return SIN_IMPORTE;

  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return SIN_IMPORTE;

  return `${formatNumber(numero, LOCALE_IMPORTES, digitos)}${ESPACIO_DURO}€`;
}

@Pipe({ name: 'euros', standalone: true })
export class EurosPipe implements PipeTransform {
  /**
   * @param digitos Formato de `DecimalPipe`. Por defecto `1.0-2`: los importes
   * redondos se ven limpios (`24 €`) y los que tienen céntimos los conservan
   * (`24,50 €`). Pásale `'1.2-2'` donde siempre deban salir los dos decimales,
   * como en las tablas de facturación.
   */
  transform(valor: number | string | null | undefined, digitos = '1.0-2'): string {
    return euros(valor, digitos);
  }
}
