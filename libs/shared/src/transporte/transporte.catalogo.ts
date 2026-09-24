/**
 * Vocabulario del flujo de Transporte de mascotas (docs/PLAN-TRANSPORTE-FLUJO-CLIENTE.md).
 *
 * Vive en `shared` porque lo hablan las tres capas: el cliente describe su
 * viaje con estos valores, el transportista declara con los mismos lo que
 * ofrece, y el cotizador del API cruza unos con otros. Si cada capa tuviera su
 * lista, «climatización» del cliente dejaría de casar con la del comercio en
 * cuanto alguien cambiase una tilde.
 *
 * Las etiquetas están en español porque son la clave de traducción (`| t`).
 */

/** Qué tipo de servicio pide el cliente en la primera pantalla. */
export enum TipoServicioTransporte {
  SOLO_IDA = 'solo_ida',
  IDA_VUELTA = 'ida_vuelta',
  RECURRENTE = 'recurrente',
  URGENTE = 'urgente',
  LARGA_DISTANCIA = 'larga_distancia',
  VIAJO_CON_MASCOTA = 'viajo_con_mascota',
}

export const TIPO_SERVICIO_TRANSPORTE_LABELS: Record<TipoServicioTransporte, string> = {
  [TipoServicioTransporte.SOLO_IDA]: 'Solo ida',
  [TipoServicioTransporte.IDA_VUELTA]: 'Ida y vuelta',
  [TipoServicioTransporte.RECURRENTE]: 'Traslado recurrente',
  [TipoServicioTransporte.URGENTE]: 'Transporte urgente',
  [TipoServicioTransporte.LARGA_DISTANCIA]: 'Viaje de larga distancia',
  [TipoServicioTransporte.VIAJO_CON_MASCOTA]: 'Viajo con mi mascota',
};

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

/** Especies que se pueden trasladar. Minúsculas: es como se guardan en la ficha de mascota. */
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
 * Traduce lo que haya en una ficha antigua («Perro», «perro», «Gato ») al valor
 * del catálogo. Lo desconocido cae en `otro`, para que el transportista vea que
 * no es ni perro ni gato en vez de que la mascota desaparezca de la cuenta.
 */
export function normalizarEspecie(valor?: string | null): EspecieMascota {
  const limpio = (valor ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!limpio) return EspecieMascota.PERRO;
  const encontrada = (Object.values(EspecieMascota) as string[]).find((e) => e === limpio);
  return (encontrada as EspecieMascota | undefined) ?? EspecieMascota.OTRO;
}

/** Cómo se organiza el viaje. */
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

/** Necesidades especiales del viaje (el «Ninguna» del PPT es la lista vacía). */
export enum NecesidadTransporte {
  TRANSPORTIN = 'transportin',
  JAULA = 'jaula',
  ARNES = 'arnes',
  MEDICACION = 'medicacion',
  MOVILIDAD_REDUCIDA = 'movilidad_reducida',
  ANIMAL_MAYOR = 'animal_mayor',
  CACHORRO = 'cachorro',
  SEPARADO = 'separado',
  ACOMPANAMIENTO_ESPECIAL = 'acompanamiento_especial',
  OTRA = 'otra',
}

export const NECESIDAD_TRANSPORTE_LABELS: Record<NecesidadTransporte, string> = {
  [NecesidadTransporte.TRANSPORTIN]: 'Transportín',
  [NecesidadTransporte.JAULA]: 'Jaula',
  [NecesidadTransporte.ARNES]: 'Arnés',
  [NecesidadTransporte.MEDICACION]: 'Viaja con medicación',
  [NecesidadTransporte.MOVILIDAD_REDUCIDA]: 'Movilidad reducida',
  [NecesidadTransporte.ANIMAL_MAYOR]: 'Animal mayor',
  [NecesidadTransporte.CACHORRO]: 'Cachorro',
  [NecesidadTransporte.SEPARADO]: 'Necesita ir separado',
  [NecesidadTransporte.ACOMPANAMIENTO_ESPECIAL]: 'Acompañamiento especial',
  [NecesidadTransporte.OTRA]: 'Otra',
};

/** Necesidades que, si el transportista lo ha pedido, pasan el viaje a presupuesto. */
export const NECESIDADES_ESPECIALES_TRANSPORTE: readonly NecesidadTransporte[] = [
  NecesidadTransporte.MOVILIDAD_REDUCIDA,
  NecesidadTransporte.ACOMPANAMIENTO_ESPECIAL,
  NecesidadTransporte.OTRA,
];

/** Cómo se comporta la mascota en un vehículo. */
export enum ComportamientoViaje {
  TRANQUILO = 'tranquilo',
  ALGO_NERVIOSO = 'algo_nervioso',
  MIEDO_COCHE = 'miedo_coche',
  REACTIVO_PERROS = 'reactivo_perros',
  REACTIVO_PERSONAS = 'reactivo_personas',
  NO_LO_SE = 'no_lo_se',
}

export const COMPORTAMIENTO_VIAJE_LABELS: Record<ComportamientoViaje, string> = {
  [ComportamientoViaje.TRANQUILO]: 'Tranquilo',
  [ComportamientoViaje.ALGO_NERVIOSO]: 'Algo nervioso',
  [ComportamientoViaje.MIEDO_COCHE]: 'Tiene miedo al coche',
  [ComportamientoViaje.REACTIVO_PERROS]: 'Reactivo con perros',
  [ComportamientoViaje.REACTIVO_PERSONAS]: 'Reactivo con personas',
  [ComportamientoViaje.NO_LO_SE]: 'No lo sé',
};

/** Equipaje de quien viaja con su mascota. */
export enum EquipajeTransporte {
  SIN_EQUIPAJE = 'sin_equipaje',
  PEQUENO = 'pequeno',
  MALETA = 'maleta',
  VARIAS_MALETAS = 'varias_maletas',
}

export const EQUIPAJE_TRANSPORTE_LABELS: Record<EquipajeTransporte, string> = {
  [EquipajeTransporte.SIN_EQUIPAJE]: 'Sin equipaje',
  [EquipajeTransporte.PEQUENO]: 'Equipaje pequeño',
  [EquipajeTransporte.MALETA]: 'Maleta',
  [EquipajeTransporte.VARIAS_MALETAS]: 'Varias maletas',
};

/** Bultos que cuenta el suplemento de equipaje. El equipaje pequeño va gratis. */
export const BULTOS_EQUIPAJE: Record<EquipajeTransporte, number> = {
  [EquipajeTransporte.SIN_EQUIPAJE]: 0,
  [EquipajeTransporte.PEQUENO]: 0,
  [EquipajeTransporte.MALETA]: 1,
  [EquipajeTransporte.VARIAS_MALETAS]: 2,
};

/**
 * Lo que el cliente puede pedir y el transportista declara incluido. Es el
 * mismo catálogo por los dos lados para que el filtro «incluidos» de los
 * resultados compare iguales con iguales.
 */
export enum PreferenciaTransporte {
  CLIMATIZACION = 'climatizacion',
  SEGUIMIENTO = 'seguimiento',
  AVISO_RECOGIDA = 'aviso_recogida',
  AVISO_ENTREGA = 'aviso_entrega',
  FOTO_TRAYECTO = 'foto_trayecto',
  TRANSPORTIN_INCLUIDO = 'transportin_incluido',
  PUERTA_A_PUERTA = 'puerta_a_puerta',
  CONDUCTOR_ESPECIALIZADO = 'conductor_especializado',
}

export const PREFERENCIA_TRANSPORTE_LABELS: Record<PreferenciaTransporte, string> = {
  [PreferenciaTransporte.CLIMATIZACION]: 'Vehículo climatizado',
  [PreferenciaTransporte.SEGUIMIENTO]: 'Seguimiento en tiempo real',
  [PreferenciaTransporte.AVISO_RECOGIDA]: 'Aviso de recogida',
  [PreferenciaTransporte.AVISO_ENTREGA]: 'Aviso de entrega',
  [PreferenciaTransporte.FOTO_TRAYECTO]: 'Foto durante el viaje',
  [PreferenciaTransporte.TRANSPORTIN_INCLUIDO]: 'Transportín incluido',
  [PreferenciaTransporte.PUERTA_A_PUERTA]: 'Puerta a puerta',
  [PreferenciaTransporte.CONDUCTOR_ESPECIALIZADO]: 'Conductor especializado',
};

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

/** Cómo quiere el cliente saber que la mascota llegó. */
export enum ConfirmacionEntrega {
  NOTIFICACION = 'notificacion',
  NOTIFICACION_FOTO = 'notificacion_foto',
  NINGUNA = 'ninguna',
}

export const CONFIRMACION_ENTREGA_LABELS: Record<ConfirmacionEntrega, string> = {
  [ConfirmacionEntrega.NOTIFICACION]: 'Notificación Doogking',
  [ConfirmacionEntrega.NOTIFICACION_FOTO]: 'Notificación + fotografía',
  [ConfirmacionEntrega.NINGUNA]: 'No es necesario',
};

/** Cómo tarifica el transportista el trayecto. El cliente no lo ve nunca. */
export enum ModoPrecioTransporte {
  POR_KM = 'por_km',
  POR_ZONA = 'por_zona',
  FIJO = 'fijo',
}

export const MODO_PRECIO_TRANSPORTE_LABELS: Record<ModoPrecioTransporte, string> = {
  [ModoPrecioTransporte.POR_KM]: 'Tarifa base + precio por kilómetro',
  [ModoPrecioTransporte.POR_ZONA]: 'Precio por zonas (provincia origen → destino)',
  [ModoPrecioTransporte.FIJO]: 'Precio fijo por trayecto',
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

/** Minutos que tiene el transportista para aceptar un viaje sin hora cerrada, por defecto. */
export const PLAZO_ACEPTACION_MIN: Record<'urgente' | 'normal', number> = {
  urgente: 30,
  normal: 12 * 60,
};
