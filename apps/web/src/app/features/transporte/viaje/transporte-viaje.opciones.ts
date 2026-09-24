import {
  COMPORTAMIENTOS_MASCOTA, CONFIRMACION_ENTREGA_LABELS, EQUIPAJE_TRANSPORTE, ESPECIE_MASCOTA_LABELS,
  FRANJA_TRANSPORTE_LABELS, MODALIDAD_TRANSPORTE_DESCRIPCIONES, MODALIDAD_TRANSPORTE_LABELS,
  MODO_HORARIO_TRANSPORTE_LABELS, ModalidadTransporte, NECESIDADES_MASCOTA, NECESIDAD_OTRA, NecesidadTransporte,
  ORDEN_TRANSPORTE_LABELS, PATRON_RECURRENCIA_TRANSPORTE_LABELS, PERSONA_CONTACTO_VIAJE_LABELS, PREFERENCIAS_VIAJE,
  PersonaContactoViaje, TAMANOS_PERRO, VUELTA_TRANSPORTE_LABELS, type OpcionCatalogo,
} from 'shared';
import type { OpcionElegible } from '../../../shared/components/opciones/rs-opciones.component';

/**
 * Las opciones de cada selector del flujo, con su icono. Los textos salen de
 * los catálogos compartidos —los mismos con los que el comercio declara en su
 * alta lo que hace— para que cliente, comercio y correos digan lo mismo; aquí
 * sólo se decide cómo se ven.
 */

const ICONO_TIPO: Record<NecesidadTransporte, string> = {
  [NecesidadTransporte.SOLO_IDA]: 'car',
  [NecesidadTransporte.IDA_VUELTA]: 'arrow-left-right',
  [NecesidadTransporte.RECURRENTE]: 'repeat',
  [NecesidadTransporte.URGENTE]: 'siren',
  [NecesidadTransporte.LARGA_DISTANCIA]: 'route',
  [NecesidadTransporte.VIAJO_CON_MI_MASCOTA]: 'users',
};

const ICONO_MODALIDAD: Record<ModalidadTransporte, string> = {
  [ModalidadTransporte.EXCLUSIVO]: 'truck',
  [ModalidadTransporte.COMPARTIDO]: 'paw',
  [ModalidadTransporte.CON_PROPIETARIO]: 'users',
};

/** Etiquetas cortas para la rejilla de 3×2 de la pantalla 1 (el catálogo trae las largas). */
const TIPO_CORTO: Record<NecesidadTransporte, string> = {
  [NecesidadTransporte.SOLO_IDA]: 'Solo ida',
  [NecesidadTransporte.IDA_VUELTA]: 'Ida y vuelta',
  [NecesidadTransporte.RECURRENTE]: 'Recurrente',
  [NecesidadTransporte.URGENTE]: 'Urgente',
  [NecesidadTransporte.LARGA_DISTANCIA]: 'Larga distancia',
  [NecesidadTransporte.VIAJO_CON_MI_MASCOTA]: 'Viajo con mi mascota',
};

/** Icono de cada preferencia o «incluido» (valores de `PREFERENCIAS_VIAJE`). */
export const ICONO_INCLUIDO: Record<string, string> = {
  climatizacion: 'snowflake', gps: 'navigation', aviso_recogida: 'bell', aviso_entrega: 'bell',
  camara: 'camera', transportin_empresa: 'box', servicio_exclusivo: 'truck', conductor_especializado: 'shield-check',
  puerta_a_puerta: 'home',
};

const ICONO_NECESIDAD: Record<string, string> = {
  transportin: 'box', medicacion: 'pill', animal_mayor: 'heart', cachorro: 'baby', separado: 'shield',
};

function desde<T extends string>(labels: Record<T, string>): OpcionElegible[] {
  return (Object.keys(labels) as T[]).map((valor) => ({ valor, etiqueta: labels[valor] }));
}

function deCatalogo(catalogo: readonly OpcionCatalogo[], iconos: Record<string, string> = {}): OpcionElegible[] {
  return catalogo.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta, icono: iconos[o.valor] }));
}

export const OPCIONES_TIPO_SERVICIO: readonly OpcionElegible[] = (Object.keys(TIPO_CORTO) as NecesidadTransporte[])
  .map((valor) => ({ valor, etiqueta: TIPO_CORTO[valor], icono: ICONO_TIPO[valor] }));

export const OPCIONES_MODO_HORARIO = desde(MODO_HORARIO_TRANSPORTE_LABELS);
export const OPCIONES_FRANJA = desde(FRANJA_TRANSPORTE_LABELS);
export const OPCIONES_VUELTA = desde(VUELTA_TRANSPORTE_LABELS);
export const OPCIONES_PATRON = desde(PATRON_RECURRENCIA_TRANSPORTE_LABELS);

/** Lunes primero, como en el calendario español; el valor sigue la convención de `Date#getDay`. */
export const OPCIONES_DIAS_SEMANA: readonly OpcionElegible[] = [
  { valor: '1', etiqueta: 'L' }, { valor: '2', etiqueta: 'M' }, { valor: '3', etiqueta: 'X' },
  { valor: '4', etiqueta: 'J' }, { valor: '5', etiqueta: 'V' }, { valor: '6', etiqueta: 'S' }, { valor: '0', etiqueta: 'D' },
];

export const OPCIONES_ESPECIE = desde(ESPECIE_MASCOTA_LABELS);

export const OPCIONES_TAMANO: readonly OpcionElegible[] = TAMANOS_PERRO.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }));

export const OPCIONES_MODALIDAD: readonly OpcionElegible[] = (Object.values(ModalidadTransporte)).map((valor) => ({
  valor,
  etiqueta: MODALIDAD_TRANSPORTE_LABELS[valor].replace('Transporte ', '').replace(/^\w/, (l) => l.toUpperCase()),
  descripcion: MODALIDAD_TRANSPORTE_DESCRIPCIONES[valor],
  icono: ICONO_MODALIDAD[valor],
}));

export const OPCIONES_PERSONAS: readonly OpcionElegible[] = [
  { valor: '1', etiqueta: '1' }, { valor: '2', etiqueta: '2' }, { valor: '3', etiqueta: '3' }, { valor: '4', etiqueta: 'Más' },
];

export const OPCIONES_EQUIPAJE = deCatalogo(EQUIPAJE_TRANSPORTE);

/** Las del comercio y «Otra», que va con texto libre. */
export const OPCIONES_NECESIDADES: readonly OpcionElegible[] = [
  ...deCatalogo(NECESIDADES_MASCOTA, ICONO_NECESIDAD),
  { valor: NECESIDAD_OTRA, etiqueta: 'Otra' },
];

export const OPCIONES_COMPORTAMIENTO = deCatalogo(COMPORTAMIENTOS_MASCOTA);

/** «Viaje exclusivo» no es una preferencia aquí: se elige como modalidad. */
export const OPCIONES_PREFERENCIAS: readonly OpcionElegible[] = deCatalogo(PREFERENCIAS_VIAJE, ICONO_INCLUIDO)
  .filter((o) => o.valor !== 'servicio_exclusivo');

/** Los «incluidos» que se pueden filtrar en resultados: las preferencias y la recogida puerta a puerta. */
export const OPCIONES_INCLUIDOS: readonly OpcionElegible[] = [
  ...OPCIONES_PREFERENCIAS,
  { valor: 'puerta_a_puerta', etiqueta: 'Puerta a puerta', icono: 'home' },
];

export const OPCIONES_ORDEN = desde(ORDEN_TRANSPORTE_LABELS);

export const OPCIONES_RECOGIDA: readonly OpcionElegible[] = [
  { valor: PersonaContactoViaje.YO, etiqueta: PERSONA_CONTACTO_VIAJE_LABELS.yo },
  { valor: PersonaContactoViaje.OTRA, etiqueta: PERSONA_CONTACTO_VIAJE_LABELS.otra },
];
export const OPCIONES_ENTREGA = desde(PERSONA_CONTACTO_VIAJE_LABELS);
export const OPCIONES_CONFIRMACION = desde(CONFIRMACION_ENTREGA_LABELS);

/** Etiqueta en español (clave de traducción) de un «incluido». */
export function etiquetaIncluido(valor: string): string {
  return OPCIONES_INCLUIDOS.find((o) => o.valor === valor)?.etiqueta ?? valor;
}
