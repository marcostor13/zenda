/**
 * Vocabulario del flujo de cliente de Transporte (docs/PLAN-TRANSPORTE-FLUJO-CLIENTE.md):
 * lo que el cliente elige al describir su viaje y lo que pasa después de pagar.
 *
 * Lo que también declara el comercio en su alta —tipo de servicio, necesidades
 * de la mascota, comportamiento, equipaje, preferencias, confirmación de
 * entrega— NO está aquí: vive en `transporte.enums.ts` y `transporte.catalogos.ts`,
 * para que lo que pide el cliente case valor a valor con lo que ofrece la empresa.
 *
 * Las etiquetas están en español porque son la clave de traducción (`| t`).
 */

/** Cómo indica el cliente la hora de recogida. */
export enum ModoHorarioTransporte {
  HORA_CONCRETA = 'hora_concreta',
  FLEXIBLE = 'flexible',
  LO_ANTES_POSIBLE = 'lo_antes_posible',
}

export const MODO_HORARIO_TRANSPORTE_LABELS: Record<ModoHorarioTransporte, string> = {
  [ModoHorarioTransporte.HORA_CONCRETA]: 'A una hora concreta',
  [ModoHorarioTransporte.FLEXIBLE]: 'Soy flexible',
  [ModoHorarioTransporte.LO_ANTES_POSIBLE]: 'Lo antes posible',
};

/** Franja de recogida cuando el cliente es flexible. */
export enum FranjaTransporte {
  MANANA = 'manana',
  MEDIODIA = 'mediodia',
  TARDE = 'tarde',
  CUALQUIERA = 'cualquiera',
}

export const FRANJA_TRANSPORTE_LABELS: Record<FranjaTransporte, string> = {
  [FranjaTransporte.MANANA]: 'Mañana',
  [FranjaTransporte.MEDIODIA]: 'Mediodía',
  [FranjaTransporte.TARDE]: 'Tarde',
  [FranjaTransporte.CUALQUIERA]: 'Cualquier horario',
};

/**
 * Hora orientativa de cada franja, en hora del comercio. La reserva necesita un
 * instante para ordenarse en la agenda; el transportista confirma la hora real
 * al aceptar el viaje.
 */
export const HORA_REFERENCIA_FRANJA: Record<FranjaTransporte, string> = {
  [FranjaTransporte.MANANA]: '09:00',
  [FranjaTransporte.MEDIODIA]: '13:00',
  [FranjaTransporte.TARDE]: '17:00',
  [FranjaTransporte.CUALQUIERA]: '09:00',
};

/** Cuándo vuelve la mascota en un trayecto de ida y vuelta. */
export enum VueltaTransporte {
  HORA = 'hora',
  TRAS_HORAS = 'tras_horas',
  CUANDO_AVISE = 'cuando_avise',
  OTRO_DIA = 'otro_dia',
}

export const VUELTA_TRANSPORTE_LABELS: Record<VueltaTransporte, string> = {
  [VueltaTransporte.HORA]: 'A una hora determinada',
  [VueltaTransporte.TRAS_HORAS]: 'Después de unas horas',
  [VueltaTransporte.CUANDO_AVISE]: 'Cuando yo avise',
  [VueltaTransporte.OTRO_DIA]: 'Otro día',
};

/** Atajos de recurrencia; todos se traducen a días de la semana salvo el mensual. */
export enum PatronRecurrenciaTransporte {
  DIARIO = 'diario',
  LABORABLES = 'laborables',
  SEMANAL = 'semanal',
  VARIAS_SEMANA = 'varias_semana',
  MENSUAL = 'mensual',
  PERSONALIZADO = 'personalizado',
}

export const PATRON_RECURRENCIA_TRANSPORTE_LABELS: Record<PatronRecurrenciaTransporte, string> = {
  [PatronRecurrenciaTransporte.DIARIO]: 'Todos los días',
  [PatronRecurrenciaTransporte.LABORABLES]: 'Días laborables',
  [PatronRecurrenciaTransporte.SEMANAL]: 'Una vez por semana',
  [PatronRecurrenciaTransporte.VARIAS_SEMANA]: 'Varias veces por semana',
  [PatronRecurrenciaTransporte.MENSUAL]: 'Una vez al mes',
  [PatronRecurrenciaTransporte.PERSONALIZADO]: 'Personalizado',
};

/**
 * Especie en la ficha de la mascota: minúscula, como la guarda el esquema.
 * El alta del comercio usa su propio catálogo con mayúscula (`ESPECIES_TRANSPORTE`)
 * y se comparan con `admiteEspecie`, que normaliza las dos.
 */
export enum EspecieMascota {
  PERRO = 'perro',
  GATO = 'gato',
  AVE = 'ave',
  CONEJO = 'conejo',
  ROEDOR = 'roedor',
  REPTIL = 'reptil',
  OTRO = 'otro',
}

export const ESPECIE_MASCOTA_LABELS: Record<EspecieMascota, string> = {
  [EspecieMascota.PERRO]: 'Perro',
  [EspecieMascota.GATO]: 'Gato',
  [EspecieMascota.AVE]: 'Ave',
  [EspecieMascota.CONEJO]: 'Conejo',
  [EspecieMascota.ROEDOR]: 'Roedor',
  [EspecieMascota.REPTIL]: 'Reptil',
  [EspecieMascota.OTRO]: 'Otro',
};

/**
 * Traduce lo que haya en una ficha («Perro», «perro», «Gato ») al valor del
 * enum. Lo desconocido cae en `otro`, para que el transportista vea que no es
 * ni perro ni gato en vez de que la mascota desaparezca de la cuenta.
 */
export function especieMascotaDe(valor?: string | null): EspecieMascota {
  const limpio = (valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!limpio) return EspecieMascota.PERRO;
  const encontrada = (Object.values(EspecieMascota) as string[]).find((e) => e === limpio);
  return (encontrada as EspecieMascota | undefined) ?? EspecieMascota.OTRO;
}

/**
 * Cómo se organiza el viaje. Sale de la plantilla con la que el comercio dio
 * de alta el servicio (`PlantillaTransporte`) y de si admite acompañantes.
 */
export enum ModalidadTransporte {
  EXCLUSIVO = 'exclusivo',
  COMPARTIDO = 'compartido',
  CON_PROPIETARIO = 'con_propietario',
}

export const MODALIDAD_TRANSPORTE_LABELS: Record<ModalidadTransporte, string> = {
  [ModalidadTransporte.EXCLUSIVO]: 'Transporte exclusivo',
  [ModalidadTransporte.COMPARTIDO]: 'Transporte compartido',
  [ModalidadTransporte.CON_PROPIETARIO]: 'Viajo con mi mascota',
};

export const MODALIDAD_TRANSPORTE_DESCRIPCIONES: Record<ModalidadTransporte, string> = {
  [ModalidadTransporte.EXCLUSIVO]: 'El vehículo va sólo con tu mascota',
  [ModalidadTransporte.COMPARTIDO]: 'Comparte trayecto con otras mascotas, más económico',
  [ModalidadTransporte.CON_PROPIETARIO]: 'Viajáis juntos en el mismo vehículo',
};

/** Necesidad libre: no está en el catálogo del comercio y va con texto. */
export const NECESIDAD_OTRA = 'otra';

/**
 * Hitos del viaje, en orden. «Reserva confirmada» no está porque no lo marca
 * nadie: es el estado de la reserva al cobrarse. Los valores `recogida`,
 * `entregada` y `finalizada` coinciden con los que ya marcaba el panel, para
 * que las reservas antiguas se sigan pintando.
 */
export enum HitoViaje {
  ASIGNADO = 'asignado',
  DE_CAMINO = 'de_camino',
  RECOGIDA = 'recogida',
  EN_TRAYECTO = 'en_trayecto',
  ENTREGADA = 'entregada',
  FINALIZADA = 'finalizada',
}

export const HITOS_VIAJE_ORDEN: readonly HitoViaje[] = [
  HitoViaje.ASIGNADO,
  HitoViaje.DE_CAMINO,
  HitoViaje.RECOGIDA,
  HitoViaje.EN_TRAYECTO,
  HitoViaje.ENTREGADA,
  HitoViaje.FINALIZADA,
];

export const HITO_VIAJE_LABELS: Record<HitoViaje, string> = {
  [HitoViaje.ASIGNADO]: 'Transportista asignado',
  [HitoViaje.DE_CAMINO]: 'De camino a la recogida',
  [HitoViaje.RECOGIDA]: 'Mascota recogida',
  [HitoViaje.EN_TRAYECTO]: 'En trayecto',
  [HitoViaje.ENTREGADA]: 'Mascota entregada',
  [HitoViaje.FINALIZADA]: 'Viaje finalizado',
};

/** El hito antiguo `en_ruta` es el `en_trayecto` de ahora. */
export function normalizarHitoViaje(hito: string): string {
  return hito === 'en_ruta' ? HitoViaje.EN_TRAYECTO : hito;
}

/** Hitos durante los que tiene sentido compartir la ubicación del vehículo. */
export const HITOS_CON_UBICACION: readonly HitoViaje[] = [
  HitoViaje.DE_CAMINO,
  HitoViaje.RECOGIDA,
  HitoViaje.EN_TRAYECTO,
];

/** Quién entrega o recibe a la mascota. */
export enum PersonaContactoViaje {
  YO = 'yo',
  OTRA = 'otra',
  EMPRESA = 'empresa',
}

export const PERSONA_CONTACTO_VIAJE_LABELS: Record<PersonaContactoViaje, string> = {
  [PersonaContactoViaje.YO]: 'Yo',
  [PersonaContactoViaje.OTRA]: 'Otra persona',
  [PersonaContactoViaje.EMPRESA]: 'Empresa',
};

/** Orden de los resultados. */
export enum OrdenTransporte {
  RECOMENDADOS = 'recomendados',
  PRECIO = 'precio',
  VALORACION = 'valoracion',
  RECOGIDA_PROXIMA = 'recogida_proxima',
  DURACION = 'duracion',
}

export const ORDEN_TRANSPORTE_LABELS: Record<OrdenTransporte, string> = {
  [OrdenTransporte.RECOMENDADOS]: 'Recomendados',
  [OrdenTransporte.PRECIO]: 'Precio más bajo',
  [OrdenTransporte.VALORACION]: 'Mejor valorados',
  [OrdenTransporte.RECOGIDA_PROXIMA]: 'Recogida más próxima',
  [OrdenTransporte.DURACION]: 'Menor duración',
};

/** Tope de mascotas en una misma solicitud; por encima, presupuesto. */
export const MAX_MASCOTAS_SOLICITUD = 10;

/** Tope de acompañantes humanos que se pueden declarar. */
export const MAX_PERSONAS_VIAJE = 8;

/** Minutos que tiene el transportista para aceptar un viaje, si no declaró los suyos. */
export const PLAZO_ACEPTACION_MIN: Record<'urgente' | 'normal', number> = {
  urgente: 30,
  normal: 12 * 60,
};
