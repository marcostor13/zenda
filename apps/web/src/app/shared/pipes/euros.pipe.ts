import { Pipe, PipeTransform, inject } from '@angular/core';
import { MonedaService } from '../../core/moneda/moneda.service';
import { CONVERSION_DE_MONEDA } from '../../core/moneda/conversion-de-moneda.token';
import { ConversionImporte, formatearImporte } from '../../core/moneda/importe';

export type { ConversionImporte } from '../../core/moneda/importe';

/**
 * Formato único de los importes de toda la aplicación.
 *
 * Se mantiene exportada como función además de como pipe porque hay pantallas
 * que componen textos con precios dentro («50 € × 3 noches», los chips de
 * filtro) y no pueden pasar por el pipe. Sin `conversion` formatea en euros:
 * es lo que quieren los tests y las pantallas de contabilidad. Para que respete
 * la divisa elegida en la cabecera, usa `MonedaService.formatear`.
 */
export { formatearImporte as euros } from '../../core/moneda/importe';

/**
 * Formatea un importe en euros con la divisa que el usuario haya elegido en la
 * cabecera.
 *
 * **Es impuro a propósito.** Un pipe puro memoiza por sus argumentos, así que
 * al cambiar la moneda —que no es un argumento sino una señal— los 130 y pico
 * importes de la aplicación seguían pintando el valor cacheado en euros: el
 * selector de la cabecera cambiaba el símbolo del propio selector y nada más.
 * El coste de la impureza lo acota la memoria de una entrada que hay debajo: si
 * ni el importe ni la divisa han cambiado, no se vuelve a formatear.
 */
@Pipe({ name: 'euros', standalone: true, pure: false })
export class EurosPipe implements PipeTransform {
  private readonly moneda = inject(MonedaService);

  /**
   * false en el panel de administración y en el del comercio: ahí los importes
   * son contabilidad —GMV, comisiones, liquidaciones, facturas—, y esas cifras
   * son en euros por definición. Enseñarlas convertidas invitaría a cuadrar
   * cuentas con un número que no aparece en ningún extracto, y bastaba con que
   * el usuario hubiera tocado el selector navegando por la parte pública.
   */
  private readonly conversionActiva = inject(CONVERSION_DE_MONEDA);

  private ultimoValor: number | string | null | undefined;
  private ultimosDigitos = '';
  private ultimaConversion: ConversionImporte | undefined;
  private ultimoTexto = '';
  private hayMemoria = false;

  /**
   * @param digitos Formato de `DecimalPipe`. Por defecto `1.0-2`: los importes
   * redondos se ven limpios (`24 €`) y los que tienen céntimos los conservan
   * (`24,50 €`). Pásale `'1.2-2'` donde siempre deban salir los dos decimales,
   * como en las tablas de facturación.
   */
  transform(valor: number | string | null | undefined, digitos = '1.0-2'): string {
    const conversion = this.conversionActiva ? this.moneda.conversion() : undefined;

    // `Object.is` y no `===` para la tasa: sin cambio vigente vale `NaN`, y
    // `NaN === NaN` es falso, así que la memoria nunca acertaría y se volvería
    // a formatear en cada ciclo de detección de cambios.
    if (this.hayMemoria
        && Object.is(valor, this.ultimoValor)
        && digitos === this.ultimosDigitos
        && conversion?.moneda === this.ultimaConversion?.moneda
        && Object.is(conversion?.tasa, this.ultimaConversion?.tasa)) {
      return this.ultimoTexto;
    }

    this.hayMemoria = true;
    this.ultimoValor = valor;
    this.ultimosDigitos = digitos;
    this.ultimaConversion = conversion;
    this.ultimoTexto = formatearImporte(valor, digitos, conversion);
    return this.ultimoTexto;
  }
}

/**
 * Importe **siempre en euros**, ignorando la divisa elegida en la cabecera.
 *
 * Para las cifras que no son una orientación sino el dato exacto: lo que se va
 * a cargar en la tarjeta. En el último paso de la reserva conviven las dos, y
 * tienen que distinguirse: el resto de la pantalla habla en la divisa del
 * usuario y esta línea dice cuánto se cobra de verdad.
 */
@Pipe({ name: 'eurosFijos', standalone: true })
export class EurosFijosPipe implements PipeTransform {
  transform(valor: number | string | null | undefined, digitos = '1.0-2'): string {
    return formatearImporte(valor, digitos);
  }
}
