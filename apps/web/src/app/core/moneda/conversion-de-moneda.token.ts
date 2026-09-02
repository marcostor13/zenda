import { InjectionToken } from '@angular/core';

/**
 * ¿Se traducen los importes de esta zona de la aplicación a la divisa elegida
 * en la cabecera?
 *
 * `true` en todo lo que ve el cliente —buscador, fichas, carrito y las cuatro
 * pantallas de la reserva—: ahí la conversión es una ayuda para hacerse una
 * idea del precio, y va siempre acompañada del aviso de que el cobro se hace
 * en euros.
 *
 * `false` en el panel de administración y en el del comercio, que se lo
 * proveen a `false` en su ruta raíz. Esas cifras —GMV, comisiones, `stripeFee`,
 * liquidaciones, facturas— son contabilidad en euros: convertirlas invitaría a
 * cuadrar cuentas contra un número que no aparece en ningún extracto, y bastaba
 * con que el usuario hubiera tocado el selector navegando por la parte pública
 * para que su panel dejara de cuadrar.
 */
export const CONVERSION_DE_MONEDA = new InjectionToken<boolean>('CONVERSION_DE_MONEDA', {
  providedIn: 'root',
  factory: () => true,
});
