import {
  COMPORTAMIENTO_VIAJE_LABELS, CONFIRMACION_ENTREGA_LABELS, EQUIPAJE_TRANSPORTE_LABELS, ESPECIE_MASCOTA_LABELS,
  FRANJA_TRANSPORTE_LABELS, MODALIDAD_TRANSPORTE_DESCRIPCIONES, MODALIDAD_TRANSPORTE_LABELS,
  MODO_HORARIO_TRANSPORTE_LABELS, ModalidadTransporte, NECESIDAD_TRANSPORTE_LABELS, ORDEN_TRANSPORTE_LABELS,
  PATRON_RECURRENCIA_TRANSPORTE_LABELS, PERSONA_CONTACTO_VIAJE_LABELS, PREFERENCIA_TRANSPORTE_LABELS,
  PersonaContactoViaje, TAMANOS_PERRO, TIPO_SERVICIO_TRANSPORTE_LABELS, TipoServicioTransporte,
  VUELTA_TRANSPORTE_LABELS,
} from 'shared';
import type { OpcionElegible } from '../../../shared/components/opciones/rs-opciones.component';

/**
 * Las opciones de cada selector del flujo, con su icono. Los textos salen del
 * catálogo compartido para que el cliente, el comercio y los correos digan lo
 * mismo; aquí sólo se decide cómo se ven.
 */

const ICONO_TIPO: Record<TipoServicioTransporte, string> = {
  [TipoServicioTransporte.SOLO_IDA]: 'car',
  [TipoServicioTransporte.IDA_VUELTA]: 'arrow-left-right',
  [TipoServicioTransporte.RECURRENTE]: 'repeat',
  [TipoServicioTransporte.URGENTE]: 'siren',
  [TipoServicioTransporte.LARGA_DISTANCIA]: 'route',
  [TipoServicioTransporte.VIAJO_CON_MASCOTA]: 'users',
};

const ICONO_MODALIDAD: Record<ModalidadTransporte, string> = {
  [ModalidadTransporte.EXCLUSIVO]: 'truck',
  [ModalidadTransporte.COMPARTIDO]: 'paw',
  [ModalidadTransporte.CON_PROPIETARIO]: 'users',
};

/** Etiquetas cortas para la rejilla de 3×2 de la pantalla 1 (el catálogo trae las largas). */
const TIPO_CORTO: Record<TipoServicioTransporte, string> = {
  [TipoServicioTransporte.SOLO_IDA]: 'Solo ida',
  [TipoServicioTransporte.IDA_VUELTA]: 'Ida y vuelta',
  [TipoServicioTransporte.RECURRENTE]: 'Recurrente',
  [TipoServicioTransporte.URGENTE]: 'Urgente',
  [TipoServicioTransporte.LARGA_DISTANCIA]: 'Larga distancia',
  [TipoServicioTransporte.VIAJO_CON_MASCOTA]: 'Viajo con mi mascota',
};

function desde<T extends string>(labels: Record<T, string>, iconos?: Partial<Record<T, string>>): OpcionElegible[] {
  return (Object.keys(labels) as T[]).map((valor) => ({ valor, etiqueta: labels[valor], icono: iconos?.[valor] }));
}

export const OPCIONES_TIPO_SERVICIO: readonly OpcionElegible[] = (Object.keys(TIPO_CORTO) as TipoServicioTransporte[])
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

export const OPCIONES_EQUIPAJE = desde(EQUIPAJE_TRANSPORTE_LABELS);

export const OPCIONES_NECESIDADES = desde(NECESIDAD_TRANSPORTE_LABELS, {
  transportin: 'box', medicacion: 'pill', animal_mayor: 'heart', cachorro: 'baby', separado: 'shield',
});

export const OPCIONES_COMPORTAMIENTO = desde(COMPORTAMIENTO_VIAJE_LABELS);

export const OPCIONES_PREFERENCIAS = desde(PREFERENCIA_TRANSPORTE_LABELS, {
  climatizacion: 'snowflake', seguimiento: 'navigation', aviso_recogida: 'bell', aviso_entrega: 'bell',
  foto_trayecto: 'camera', transportin_incluido: 'box', puerta_a_puerta: 'home', conductor_especializado: 'shield-check',
});

export const OPCIONES_ORDEN = desde(ORDEN_TRANSPORTE_LABELS);

export const OPCIONES_RECOGIDA: readonly OpcionElegible[] = [
  { valor: PersonaContactoViaje.YO, etiqueta: PERSONA_CONTACTO_VIAJE_LABELS.yo },
  { valor: PersonaContactoViaje.OTRA, etiqueta: PERSONA_CONTACTO_VIAJE_LABELS.otra },
];
export const OPCIONES_ENTREGA = desde(PERSONA_CONTACTO_VIAJE_LABELS);
export const OPCIONES_CONFIRMACION = desde(CONFIRMACION_ENTREGA_LABELS);

/** Icono de cada «incluido» en las tarjetas de resultados. */
export const ICONO_INCLUIDO: Record<string, string> = {
  climatizacion: 'snowflake', seguimiento: 'navigation', aviso_recogida: 'bell', aviso_entrega: 'bell',
  foto_trayecto: 'camera', transportin_incluido: 'box', puerta_a_puerta: 'home', conductor_especializado: 'shield-check',
};
