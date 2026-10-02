/**
 * El `detalle` de una reserva lo escribe el cliente y viaja tal cual a la
 * estrategia del vertical como `parametrosExtra`, y después a `reserva.detalle`.
 *
 * Por ese mismo canal el core pasa datos que **sólo** puede poner el servidor:
 * el importe pactado de un presupuesto (`precioAcordado`), las marcas que deja
 * la estrategia y la ficha congelada del perro. Si el cliente los manda, se
 * descartan: el importe se calcula siempre en el servidor a partir del
 * servicio, nunca a partir de lo que diga la petición.
 */

/** Prefijos de importes: ninguno lo decide el cliente. */
const PREFIJOS_IMPORTE = /^(precio|monto|importe|comision|descuento|total|subtotal|iva|tarifa)/i;

/** Claves exactas que pone el servidor (ficha del perro y marcas internas). */
const CLAVES_DEL_SERVIDOR = new Set([
  'perroTamano', 'perroTipoPelo', 'perroPeso', 'perroEspecie', 'perroEsPPP', 'perroRaza',
  'perroAnsiedadSeparacion', 'perroProtectorRecursos', 'perroReactividadCorrea',
  'perroDestructivoEnSoledad', 'perroTendenciaEscapar',
  'validarHorarioEstancia', 'requierePresupuesto', 'cubiertaPorSerie', 'viajes',
]);

export function esClaveDelServidor(clave: string): boolean {
  return PREFIJOS_IMPORTE.test(clave) || CLAVES_DEL_SERVIDOR.has(clave);
}

/** Copia del detalle sin lo que sólo puede decidir el servidor. */
export function limpiarDetalleCliente(
  detalle: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!detalle) return detalle;
  return Object.fromEntries(Object.entries(detalle).filter(([clave]) => !esClaveDelServidor(clave)));
}
