import { VerticalKey } from '../enums/vertical.enum';
import { claveDiaEnZona } from '../fechas/zona-horaria';
import { claveUbicacion } from '../ubicaciones/normalizar-ubicacion';
import { PROVINCIAS_ES } from '../ubicaciones/municipios';
import { resolverMunicipio } from '../ubicaciones/resolver-municipio';

/**
 * Reglas del planificador de viajes que comparten la web y el API: qué destino
 * se ha escrito, qué fechas valen y qué categorías caben en un viaje **junto**
 * al perro. Las dos puntas validan lo mismo para que el formulario no deje
 * pasar algo que luego el API rechaza (bloqueos del cliente, octubre).
 */

/** Servicios que se pueden pedir durante el viaje (pregunta del formulario). */
export const SERVICIOS_EXTRA_VIAJE: readonly VerticalKey[] = [
  VerticalKey.PELUQUERIA, VerticalKey.VETERINARIA, VerticalKey.ADIESTRAMIENTO,
];

/**
 * Categorías que nunca forman parte de un viaje con el perro: una residencia o
 * guardería canina es para **dejarlo**, no para dormir con él, y un servicio
 * funerario no pinta nada en una escapada. Dónde dormir sale sólo de hoteles.
 */
export const VERTICALES_FUERA_DEL_VIAJE: readonly VerticalKey[] = [
  VerticalKey.ALOJAMIENTO, VerticalKey.FUNERARIOS,
];

/** El alojamiento de un viaje con el perro: hoteles pet friendly, nada más. */
export const VERTICAL_ALOJAMIENTO_VIAJE = VerticalKey.HOTELES;

/** Destino escrito por el usuario, interpretado. */
export interface DestinoViaje {
  /** Provincia, si se reconoce (o si lo escrito ya es una provincia). */
  readonly provincia?: string;
  /** Población concreta, si lo escrito no es una provincia. */
  readonly municipio?: string;
  /** Cómo se enseña: «Dénia (Alicante)», «Valencia»… */
  readonly etiqueta: string;
}

const PROVINCIA_POR_CLAVE = new Map(PROVINCIAS_ES.map((p) => [claveUbicacion(p), p]));

/**
 * Interpreta el destino: una provincia, una población conocida (con su
 * provincia) o, si no está en el catálogo, la población tal como se escribió.
 * `null` sólo si no hay nada escrito: cualquier municipio de España vale.
 */
export function resolverDestinoViaje(texto: string): DestinoViaje | null {
  const limpio = (texto ?? '').trim().replace(/\s+/g, ' ');
  // «Dénia (Alicante)» es como lo enseña el desplegable: se aceptan ambas partes.
  const [nombre, provinciaEscrita] = limpio.replace(/\)$/, '').split(/\s*\(\s*/);
  if (!nombre || nombre.length < 2) return null;

  const provincia = PROVINCIA_POR_CLAVE.get(claveUbicacion(nombre));
  if (provincia && !provinciaEscrita) return { provincia, etiqueta: provincia };

  const municipio = resolverMunicipio(nombre)?.municipio;
  const provinciaFinal = municipio?.provincia
    ?? (provinciaEscrita ? PROVINCIA_POR_CLAVE.get(claveUbicacion(provinciaEscrita)) ?? provinciaEscrita : undefined);
  const ciudad = municipio?.nombre ?? nombre;
  return {
    municipio: ciudad,
    provincia: provinciaFinal,
    etiqueta: provinciaFinal && claveUbicacion(provinciaFinal) !== claveUbicacion(ciudad)
      ? `${ciudad} (${provinciaFinal})` : ciudad,
  };
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MS_DIA = 24 * 60 * 60 * 1000;

/** Días de calendario entre dos fechas `YYYY-MM-DD` (sin horas: sin cambios de hora). */
export function diasEntreFechas(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_DIA);
}

/** Noches de un viaje: 0 si se vuelve el mismo día. */
export function nochesDelViaje(desde: string, hasta: string): number {
  return Math.max(0, diasEntreFechas(desde, hasta));
}

function fechaValida(texto: string | undefined): texto is string {
  return !!texto && ES_FECHA.test(texto) && !Number.isNaN(Date.parse(`${texto}T00:00:00Z`));
}

/**
 * Comprueba las fechas del viaje; devuelve el motivo si no valen o `null`.
 *
 * «Hoy» es el de Madrid, no el del servidor ni el del navegador: un viaje que
 * empieza hoy pasado medianoche peninsular no debe rechazarse por ir en UTC.
 */
export function errorFechasViaje(desde?: string, hasta?: string, ahora: Date = new Date()): string | null {
  if (!desde || !hasta) return 'Indica las fechas de ida y vuelta del viaje';
  if (!fechaValida(desde) || !fechaValida(hasta)) return 'Las fechas del viaje no son válidas';
  if (desde < claveDiaEnZona(ahora)) return 'La fecha de ida no puede ser anterior a hoy';
  if (hasta < desde) return 'La fecha de vuelta no puede ser anterior a la de ida';
  return null;
}
