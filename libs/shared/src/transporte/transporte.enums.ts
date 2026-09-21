/**
 * Vocabulario de la categoría "Transporte de mascotas".
 *
 * Vive en `shared` porque lo usan las tres capas y tiene que significar lo
 * mismo en todas: el alta del comercio declara con estos valores cómo trabaja,
 * el motor de tarifas (`transporte-precio.ts`) calcula el importe con ellos, y
 * el cliente describe su necesidad sin llegar a verlos nunca.
 *
 * Esa última parte es la regla que ordena todo el vertical: **el cliente
 * describe su necesidad; Doogking la traduce al sistema tarifario de cada
 * empresa**. Nadie le pregunta al dueño del perro si quiere pagar «por km» o
 * «por zona»: eso lo decide la empresa aquí y el motor lo resuelve solo.
 */

/**
 * Plantilla comercial del servicio. Cada modalidad se publica como un servicio
 * distinto, porque cambian el precio, la capacidad y lo que se le pregunta al
 * cliente; un mismo servicio sí puede tener varias reglas de tarifa.
 */
export enum PlantillaTransporte {
  EXCLUSIVO = 'exclusivo',
  TAXI_PETFRIENDLY = 'taxi_petfriendly',
  COMPARTIDO = 'compartido',
  RUTA_PROGRAMADA = 'ruta_programada',
  ESPECIAL = 'especial',
}

export const PLANTILLA_TRANSPORTE_LABELS: Record<PlantillaTransporte, string> = {
  [PlantillaTransporte.EXCLUSIVO]: 'Transporte exclusivo de mascotas',
  [PlantillaTransporte.TAXI_PETFRIENDLY]: 'Taxi pet-friendly',
  [PlantillaTransporte.COMPARTIDO]: 'Transporte compartido',
  [PlantillaTransporte.RUTA_PROGRAMADA]: 'Ruta programada',
  [PlantillaTransporte.ESPECIAL]: 'Transporte especial o internacional',
};

export const PLANTILLA_TRANSPORTE_DESCRIPCIONES: Record<PlantillaTransporte, string> = {
  [PlantillaTransporte.EXCLUSIVO]: 'Solo viajan mascotas de una misma familia.',
  [PlantillaTransporte.TAXI_PETFRIENDLY]: 'Viajan la mascota y una o varias personas.',
  [PlantillaTransporte.COMPARTIDO]: 'Viajan animales de distintas familias, separados.',
  [PlantillaTransporte.RUTA_PROGRAMADA]: 'Salida, paradas, fecha y plazas definidas.',
  [PlantillaTransporte.ESPECIAL]: 'Documentación, aeropuerto, barco o presupuesto.',
};

export enum QuienViaja {
  SOLO_MASCOTA = 'solo_mascota',
  MASCOTA_Y_RESPONSABLE = 'mascota_y_responsable',
  AMBAS = 'ambas',
}

export const QUIEN_VIAJA_LABELS: Record<QuienViaja, string> = {
  [QuienViaja.SOLO_MASCOTA]: 'Solo la mascota',
  [QuienViaja.MASCOTA_Y_RESPONSABLE]: 'La mascota y su responsable',
  [QuienViaja.AMBAS]: 'Ambas posibilidades',
};

export enum TipoTrayecto {
  SOLO_IDA = 'solo_ida',
  IDA_VUELTA = 'ida_vuelta',
  RECURRENTE = 'recurrente',
  URGENTE = 'urgente',
}

export const TIPO_TRAYECTO_LABELS: Record<TipoTrayecto, string> = {
  [TipoTrayecto.SOLO_IDA]: 'Solo ida',
  [TipoTrayecto.IDA_VUELTA]: 'Ida y vuelta',
  [TipoTrayecto.RECURRENTE]: 'Recurrente',
  [TipoTrayecto.URGENTE]: 'Urgente',
};

export enum AmbitoTransporte {
  LOCAL = 'local',
  PROVINCIAL = 'provincial',
  NACIONAL = 'nacional',
  INTERNACIONAL = 'internacional',
  AEROPUERTO = 'aeropuerto',
  PUERTO = 'puerto',
}

export const AMBITO_TRANSPORTE_LABELS: Record<AmbitoTransporte, string> = {
  [AmbitoTransporte.LOCAL]: 'Local',
  [AmbitoTransporte.PROVINCIAL]: 'Provincial',
  [AmbitoTransporte.NACIONAL]: 'Nacional',
  [AmbitoTransporte.INTERNACIONAL]: 'Internacional',
  [AmbitoTransporte.AEROPUERTO]: 'Aeropuerto',
  [AmbitoTransporte.PUERTO]: 'Puerto',
};

export enum TipoRecogida {
  PUERTA_A_PUERTA = 'puerta_a_puerta',
  PUNTO_ENCUENTRO = 'punto_encuentro',
  EN_BASE = 'en_base',
}

export const TIPO_RECOGIDA_LABELS: Record<TipoRecogida, string> = {
  [TipoRecogida.PUERTA_A_PUERTA]: 'Puerta a puerta',
  [TipoRecogida.PUNTO_ENCUENTRO]: 'Punto de encuentro acordado',
  [TipoRecogida.EN_BASE]: 'El cliente lleva la mascota a la base',
};

/** Para qué se usa habitualmente el traslado; ordena los resultados del buscador. */
export enum FinalidadTransporte {
  CUALQUIERA = 'cualquiera',
  VETERINARIO = 'veterinario',
  RESIDENCIA = 'residencia',
  PELUQUERIA = 'peluqueria',
  AEROPUERTO_PUERTO = 'aeropuerto_puerto',
  MUDANZA = 'mudanza',
  ADOPCION = 'adopcion',
}

export const FINALIDAD_TRANSPORTE_LABELS: Record<FinalidadTransporte, string> = {
  [FinalidadTransporte.CUALQUIERA]: 'Cualquier destino',
  [FinalidadTransporte.VETERINARIO]: 'Veterinario',
  [FinalidadTransporte.RESIDENCIA]: 'Residencia o guardería',
  [FinalidadTransporte.PELUQUERIA]: 'Peluquería',
  [FinalidadTransporte.AEROPUERTO_PUERTO]: 'Aeropuerto o puerto',
  [FinalidadTransporte.MUDANZA]: 'Mudanza o cambio de residencia',
  [FinalidadTransporte.ADOPCION]: 'Adopción o entrega autorizada',
};

// ── Cobertura y trayecto ────────────────────────────────────────────────

export enum ModoCobertura {
  RADIO = 'radio',
  MUNICIPIOS = 'municipios',
  PROVINCIAS = 'provincias',
  NACIONAL = 'nacional',
  PAISES = 'paises',
  RUTAS_FIJAS = 'rutas_fijas',
  PRESUPUESTO = 'presupuesto',
}

export const MODO_COBERTURA_LABELS: Record<ModoCobertura, string> = {
  [ModoCobertura.RADIO]: 'Radio desde la base',
  [ModoCobertura.MUNICIPIOS]: 'Municipios seleccionados',
  [ModoCobertura.PROVINCIAS]: 'Provincias seleccionadas',
  [ModoCobertura.NACIONAL]: 'Todo el territorio nacional',
  [ModoCobertura.PAISES]: 'Países seleccionados',
  [ModoCobertura.RUTAS_FIJAS]: 'Rutas fijas',
  [ModoCobertura.PRESUPUESTO]: 'Destino personalizado con presupuesto',
};

/** Qué puntos del trayecto puede escribir el cliente y cuáles fija la empresa. */
export enum PuntosTrayecto {
  LIBRES = 'libres',
  ORIGEN_FIJO = 'origen_fijo',
  DESTINO_FIJO = 'destino_fijo',
  AMBOS_FIJOS = 'ambos_fijos',
}

export const PUNTOS_TRAYECTO_LABELS: Record<PuntosTrayecto, string> = {
  [PuntosTrayecto.LIBRES]: 'Origen y destino libres dentro de la cobertura',
  [PuntosTrayecto.ORIGEN_FIJO]: 'Origen fijo y destino libre',
  [PuntosTrayecto.DESTINO_FIJO]: 'Origen libre y destino fijo',
  [PuntosTrayecto.AMBOS_FIJOS]: 'Ambos puntos fijos',
};

/**
 * Qué kilómetros se facturan. No es lo mismo el trayecto del cliente que el
 * que hace la furgoneta: quien sale de su base a 40 km de la recogida no puede
 * cobrar solo el tramo del medio, y quien trabaja en ciudad no quiere cobrar
 * el regreso en vacío.
 */
export enum BaseKilometraje {
  RECOGIDA_DESTINO = 'recogida_destino',
  BASE_RECOGIDA_DESTINO = 'base_recogida_destino',
  CIRCUITO_COMPLETO = 'circuito_completo',
  TRAMOS_SEPARADOS = 'tramos_separados',
}

export const BASE_KILOMETRAJE_LABELS: Record<BaseKilometraje, string> = {
  [BaseKilometraje.RECOGIDA_DESTINO]: 'Recogida hasta destino',
  [BaseKilometraje.BASE_RECOGIDA_DESTINO]: 'Base hasta recogida y destino',
  [BaseKilometraje.CIRCUITO_COMPLETO]: 'Base, recogida, destino y regreso a la base',
  [BaseKilometraje.TRAMOS_SEPARADOS]: 'Kilómetros de cada tramo por separado',
};

export enum TipoIdaVuelta {
  ESPERA_MISMO_DIA = 'espera_mismo_dia',
  REGRESO_MAS_TARDE = 'regreso_mas_tarde',
  OTRA_FECHA = 'otra_fecha',
  DOS_TRAYECTOS = 'dos_trayectos',
}

export const TIPO_IDA_VUELTA_LABELS: Record<TipoIdaVuelta, string> = {
  [TipoIdaVuelta.ESPERA_MISMO_DIA]: 'Espera y regreso el mismo día',
  [TipoIdaVuelta.REGRESO_MAS_TARDE]: 'Regreso más tarde el mismo día',
  [TipoIdaVuelta.OTRA_FECHA]: 'Regreso en otra fecha',
  [TipoIdaVuelta.DOS_TRAYECTOS]: 'Dos trayectos independientes',
};

export enum PoliticaParadas {
  NO_PERMITIDAS = 'no_permitidas',
  INCLUIDAS = 'incluidas',
  CON_SUPLEMENTO = 'con_suplemento',
}

export const POLITICA_PARADAS_LABELS: Record<PoliticaParadas, string> = {
  [PoliticaParadas.NO_PERMITIDAS]: 'No permitidas',
  [PoliticaParadas.INCLUIDAS]: 'Permitidas sin coste',
  [PoliticaParadas.CON_SUPLEMENTO]: 'Permitidas con suplemento',
};

export enum PoliticaPeajes {
  INCLUIDOS = 'incluidos',
  SUPLEMENTO_FIJO = 'suplemento_fijo',
  ANTES_DE_CONFIRMAR = 'antes_de_confirmar',
  SOLO_PRESUPUESTO = 'solo_presupuesto',
}

export const POLITICA_PEAJES_LABELS: Record<PoliticaPeajes, string> = {
  [PoliticaPeajes.INCLUIDOS]: 'Incluidos en el precio',
  [PoliticaPeajes.SUPLEMENTO_FIJO]: 'Suplemento fijo configurado',
  [PoliticaPeajes.ANTES_DE_CONFIRMAR]: 'Se calculan antes de confirmar',
  [PoliticaPeajes.SOLO_PRESUPUESTO]: 'Solo disponible mediante presupuesto',
};

// ── Precio ──────────────────────────────────────────────────────────────

export enum ModeloPrecio {
  FIJO = 'fijo',
  ZONA = 'zona',
  KM = 'km',
  BASE_MAS_KM = 'base_mas_km',
  TRAMOS = 'tramos',
  HORA = 'hora',
  RUTA_FIJA = 'ruta_fija',
  PRESUPUESTO = 'presupuesto',
}

export const MODELO_PRECIO_LABELS: Record<ModeloPrecio, string> = {
  [ModeloPrecio.FIJO]: 'Precio fijo',
  [ModeloPrecio.ZONA]: 'Precio por zona',
  [ModeloPrecio.KM]: 'Precio por kilómetro',
  [ModeloPrecio.BASE_MAS_KM]: 'Tarifa base más precio por kilómetro',
  [ModeloPrecio.TRAMOS]: 'Precio por tramos de distancia',
  [ModeloPrecio.HORA]: 'Precio por hora',
  [ModeloPrecio.RUTA_FIJA]: 'Precio por ruta fija',
  [ModeloPrecio.PRESUPUESTO]: 'Presupuesto personalizado',
};

export enum UnidadCobro {
  VEHICULO = 'vehiculo',
  MASCOTA = 'mascota',
  PLAZA = 'plaza',
  PERSONA_Y_MASCOTA = 'persona_y_mascota',
  TRAYECTO = 'trayecto',
  HORA = 'hora',
}

export const UNIDAD_COBRO_LABELS: Record<UnidadCobro, string> = {
  [UnidadCobro.VEHICULO]: 'Por vehículo o familia',
  [UnidadCobro.MASCOTA]: 'Por mascota',
  [UnidadCobro.PLAZA]: 'Por plaza o transportín',
  [UnidadCobro.PERSONA_Y_MASCOTA]: 'Por persona y mascota',
  [UnidadCobro.TRAYECTO]: 'Por trayecto',
  [UnidadCobro.HORA]: 'Por hora',
};

export enum RedondeoDistancia {
  EXACTA = 'exacta',
  KM_SUPERIOR = 'km_superior',
  BLOQUES_5 = 'bloques_5',
  BLOQUES_10 = 'bloques_10',
}

export const REDONDEO_DISTANCIA_LABELS: Record<RedondeoDistancia, string> = {
  [RedondeoDistancia.EXACTA]: 'Distancia exacta',
  [RedondeoDistancia.KM_SUPERIOR]: 'Kilómetro completo superior',
  [RedondeoDistancia.BLOQUES_5]: 'Bloques de 5 km',
  [RedondeoDistancia.BLOQUES_10]: 'Bloques de 10 km',
};

export enum FormaCalculoSuplemento {
  IMPORTE_FIJO = 'importe_fijo',
  PORCENTAJE = 'porcentaje',
  POR_KM = 'por_km',
  POR_HORA = 'por_hora',
  POR_MASCOTA = 'por_mascota',
  POR_PASAJERO = 'por_pasajero',
  POR_PARADA = 'por_parada',
}

export const FORMA_CALCULO_SUPLEMENTO_LABELS: Record<FormaCalculoSuplemento, string> = {
  [FormaCalculoSuplemento.IMPORTE_FIJO]: 'Importe fijo',
  [FormaCalculoSuplemento.PORCENTAJE]: 'Porcentaje del servicio',
  [FormaCalculoSuplemento.POR_KM]: 'Por kilómetro',
  [FormaCalculoSuplemento.POR_HORA]: 'Por hora',
  [FormaCalculoSuplemento.POR_MASCOTA]: 'Por mascota',
  [FormaCalculoSuplemento.POR_PASAJERO]: 'Por pasajero',
  [FormaCalculoSuplemento.POR_PARADA]: 'Por parada',
};

/**
 * Cuándo entra el suplemento en el total.
 *
 * `AUTOMATICA` lo suma el motor cuando se cumple su condición (una urgencia, un
 * horario nocturno). `A_PETICION` solo si el cliente lo marca. `CONFIRMA_EMPRESA`
 * nunca entra en el precio cerrado: se propone después como ajuste, porque
 * cobrar algo que el cliente no aceptó antes de pagar rompe la regla de
 * «precio final antes de pagar».
 */
export enum AplicacionSuplemento {
  AUTOMATICA = 'automatica',
  A_PETICION = 'a_peticion',
  CONFIRMA_EMPRESA = 'confirma_empresa',
}

export const APLICACION_SUPLEMENTO_LABELS: Record<AplicacionSuplemento, string> = {
  [AplicacionSuplemento.AUTOMATICA]: 'Automáticamente',
  [AplicacionSuplemento.A_PETICION]: 'Solo si el cliente lo pide',
  [AplicacionSuplemento.CONFIRMA_EMPRESA]: 'Lo confirma la empresa después',
};

/**
 * Condición que dispara un suplemento automático. Es el puente entre lo que el
 * cliente pide sin saberlo (viajar un domingo, dos mascotas) y lo que la
 * empresa cobra por ello.
 */
export enum CondicionSuplemento {
  SIEMPRE = 'siempre',
  MASCOTA_ADICIONAL = 'mascota_adicional',
  PASAJERO_ADICIONAL = 'pasajero_adicional',
  URGENCIA = 'urgencia',
  NOCTURNO = 'nocturno',
  FIN_DE_SEMANA = 'fin_de_semana',
  PARADA_ADICIONAL = 'parada_adicional',
  ESPERA = 'espera',
  FUERA_DE_ZONA = 'fuera_de_zona',
  AEROPUERTO_PUERTO = 'aeropuerto_puerto',
}

export const CONDICION_SUPLEMENTO_LABELS: Record<CondicionSuplemento, string> = {
  [CondicionSuplemento.SIEMPRE]: 'Siempre',
  [CondicionSuplemento.MASCOTA_ADICIONAL]: 'A partir de la segunda mascota',
  [CondicionSuplemento.PASAJERO_ADICIONAL]: 'A partir del segundo pasajero',
  [CondicionSuplemento.URGENCIA]: 'Si el servicio es urgente',
  [CondicionSuplemento.NOCTURNO]: 'En horario nocturno',
  [CondicionSuplemento.FIN_DE_SEMANA]: 'Fin de semana o festivo',
  [CondicionSuplemento.PARADA_ADICIONAL]: 'Por cada parada extra',
  [CondicionSuplemento.ESPERA]: 'Por el tiempo de espera',
  [CondicionSuplemento.FUERA_DE_ZONA]: 'Recogida fuera de zona',
  [CondicionSuplemento.AEROPUERTO_PUERTO]: 'Aeropuerto o puerto',
};

// ── Mascotas, vehículo y documentación ──────────────────────────────────

export enum CompartidoTransporte {
  MISMA_FAMILIA = 'misma_familia',
  DISTINTAS_SEPARADAS = 'distintas_separadas',
  DISTINTAS_COMPATIBLES = 'distintas_compatibles',
  NO_OFRECE = 'no_ofrece',
}

export const COMPARTIDO_TRANSPORTE_LABELS: Record<CompartidoTransporte, string> = {
  [CompartidoTransporte.MISMA_FAMILIA]: 'Solo misma familia',
  [CompartidoTransporte.DISTINTAS_SEPARADAS]: 'Familias distintas, separadas',
  [CompartidoTransporte.DISTINTAS_COMPATIBLES]: 'Familias distintas, compatibles',
  [CompartidoTransporte.NO_OFRECE]: 'No ofrezco compartido',
};

export enum PrecioAcompanante {
  INCLUIDO = 'incluido',
  SUPLEMENTO = 'suplemento',
  PRIMERO_INCLUIDO = 'primero_incluido',
  PRESUPUESTO = 'presupuesto',
}

export const PRECIO_ACOMPANANTE_LABELS: Record<PrecioAcompanante, string> = {
  [PrecioAcompanante.INCLUIDO]: 'Incluido',
  [PrecioAcompanante.SUPLEMENTO]: 'Suplemento por persona',
  [PrecioAcompanante.PRIMERO_INCLUIDO]: 'Incluye 1, resto con suplemento',
  [PrecioAcompanante.PRESUPUESTO]: 'Solo mediante presupuesto',
};

/** Cuándo se exige un requisito documental. */
export enum ExigenciaRequisito {
  SIEMPRE = 'siempre',
  NACIONAL = 'nacional',
  INTERNACIONAL = 'internacional',
  SEGUN_DESTINO = 'segun_destino',
  MASCOTA_SOLA = 'mascota_sola',
  OPCIONAL = 'opcional',
}

export const EXIGENCIA_REQUISITO_LABELS: Record<ExigenciaRequisito, string> = {
  [ExigenciaRequisito.SIEMPRE]: 'Siempre obligatorio',
  [ExigenciaRequisito.NACIONAL]: 'Solo en viajes nacionales',
  [ExigenciaRequisito.INTERNACIONAL]: 'Solo en viajes internacionales',
  [ExigenciaRequisito.SEGUN_DESTINO]: 'Según destino',
  [ExigenciaRequisito.MASCOTA_SOLA]: 'Solo si la mascota viaja sola',
  [ExigenciaRequisito.OPCIONAL]: 'Opcional',
};

// ── Disponibilidad y condiciones ────────────────────────────────────────

export enum ModoDisponibilidadTransporte {
  CALENDARIO = 'calendario',
  BAJO_DEMANDA = 'bajo_demanda',
  SALIDAS_PROGRAMADAS = 'salidas_programadas',
  SOLO_PRESUPUESTO = 'solo_presupuesto',
}

export const MODO_DISPONIBILIDAD_TRANSPORTE_LABELS: Record<ModoDisponibilidadTransporte, string> = {
  [ModoDisponibilidadTransporte.CALENDARIO]: 'Calendario y horarios',
  [ModoDisponibilidadTransporte.BAJO_DEMANDA]: 'Servicio bajo demanda',
  [ModoDisponibilidadTransporte.SALIDAS_PROGRAMADAS]: 'Salidas programadas',
  [ModoDisponibilidadTransporte.SOLO_PRESUPUESTO]: 'Solo mediante presupuesto',
};

export enum VentanaRecogida {
  HORA_EXACTA = 'hora_exacta',
  FRANJA_30 = 'franja_30',
  FRANJA_60 = 'franja_60',
  FRANJA_120 = 'franja_120',
  CONFIRMA_EMPRESA = 'confirma_empresa',
}

export const VENTANA_RECOGIDA_LABELS: Record<VentanaRecogida, string> = {
  [VentanaRecogida.HORA_EXACTA]: 'Hora exacta',
  [VentanaRecogida.FRANJA_30]: 'Franja de 30 minutos',
  [VentanaRecogida.FRANJA_60]: 'Franja de 1 hora',
  [VentanaRecogida.FRANJA_120]: 'Franja de 2 horas',
  [VentanaRecogida.CONFIRMA_EMPRESA]: 'La empresa confirma la hora',
};

export enum FrecuenciaRecurrencia {
  DIARIA = 'diaria',
  LABORABLES = 'laborables',
  DIAS_CONCRETOS = 'dias_concretos',
  SEMANAL = 'semanal',
  QUINCENAL = 'quincenal',
  MENSUAL = 'mensual',
  PERSONALIZADA = 'personalizada',
}

export const FRECUENCIA_RECURRENCIA_LABELS: Record<FrecuenciaRecurrencia, string> = {
  [FrecuenciaRecurrencia.DIARIA]: 'Diaria',
  [FrecuenciaRecurrencia.LABORABLES]: 'De lunes a viernes',
  [FrecuenciaRecurrencia.DIAS_CONCRETOS]: 'Días concretos',
  [FrecuenciaRecurrencia.SEMANAL]: 'Semanal',
  [FrecuenciaRecurrencia.QUINCENAL]: 'Quincenal',
  [FrecuenciaRecurrencia.MENSUAL]: 'Mensual',
  [FrecuenciaRecurrencia.PERSONALIZADA]: 'Personalizada',
};

export enum PoliticaCancelacionTransporte {
  ESTANDAR = 'estandar',
  NO_REEMBOLSABLE = 'no_reembolsable',
}

export const POLITICA_CANCELACION_TRANSPORTE_LABELS: Record<PoliticaCancelacionTransporte, string> = {
  [PoliticaCancelacionTransporte.ESTANDAR]: 'Estándar de transporte',
  [PoliticaCancelacionTransporte.NO_REEMBOLSABLE]: 'Tarifa no reembolsable con descuento',
};

export const POLITICA_CANCELACION_TRANSPORTE_TEXTOS: Record<PoliticaCancelacionTransporte, string> = {
  [PoliticaCancelacionTransporte.ESTANDAR]:
    'Cancelación gratuita hasta 24 horas antes. Dentro de las 24 horas no se devuelve el importe.',
  [PoliticaCancelacionTransporte.NO_REEMBOLSABLE]:
    'Tarifa reducida a cambio de no admitir cancelaciones una vez confirmada la reserva.',
};

export enum AccionNoShow {
  COBRO_COMPLETO = 'cobro_completo',
  COBRO_PARCIAL = 'cobro_parcial',
  REPROGRAMACION = 'reprogramacion',
}

export const ACCION_NO_SHOW_LABELS: Record<AccionNoShow, string> = {
  [AccionNoShow.COBRO_COMPLETO]: 'Cobro completo',
  [AccionNoShow.COBRO_PARCIAL]: 'Cobro parcial aprobado por Doogking',
  [AccionNoShow.REPROGRAMACION]: 'Reprogramación si la empresa acepta',
};

/** Cómo se enseña el precio de un servicio que solo se cierra por presupuesto. */
export enum PrecioOrientativo {
  NO_MOSTRAR = 'no_mostrar',
  DESDE = 'desde',
  INTERVALO = 'intervalo',
}

export const PRECIO_ORIENTATIVO_LABELS: Record<PrecioOrientativo, string> = {
  [PrecioOrientativo.NO_MOSTRAR]: 'No mostrar precio',
  [PrecioOrientativo.DESDE]: 'Mostrar «Desde»',
  [PrecioOrientativo.INTERVALO]: 'Mostrar un intervalo estimado',
};

// ── Lado del cliente ────────────────────────────────────────────────────

/** Lo primero que se le pregunta al cliente: «¿qué tipo de servicio necesitas?». */
export enum NecesidadTransporte {
  SOLO_IDA = 'solo_ida',
  IDA_VUELTA = 'ida_vuelta',
  RECURRENTE = 'recurrente',
  URGENTE = 'urgente',
  LARGA_DISTANCIA = 'larga_distancia',
  VIAJO_CON_MI_MASCOTA = 'viajo_con_mi_mascota',
}

export const NECESIDAD_TRANSPORTE_LABELS: Record<NecesidadTransporte, string> = {
  [NecesidadTransporte.SOLO_IDA]: 'Solo ida',
  [NecesidadTransporte.IDA_VUELTA]: 'Ida y vuelta',
  [NecesidadTransporte.RECURRENTE]: 'Traslado recurrente',
  [NecesidadTransporte.URGENTE]: 'Transporte urgente',
  [NecesidadTransporte.LARGA_DISTANCIA]: 'Viaje de larga distancia',
  [NecesidadTransporte.VIAJO_CON_MI_MASCOTA]: 'Quiero viajar con mi mascota',
};

/** Modalidad del viaje, tal y como la elige el cliente. */
export enum ModalidadViaje {
  EXCLUSIVO = 'exclusivo',
  COMPARTIDO = 'compartido',
  VIAJO_CON_MI_MASCOTA = 'viajo_con_mi_mascota',
}

export const MODALIDAD_VIAJE_LABELS: Record<ModalidadViaje, string> = {
  [ModalidadViaje.EXCLUSIVO]: 'Transporte exclusivo',
  [ModalidadViaje.COMPARTIDO]: 'Transporte compartido',
  [ModalidadViaje.VIAJO_CON_MI_MASCOTA]: 'Viajo con mi mascota',
};

/** Flexibilidad horaria del cliente. Condiciona qué transportistas encajan. */
export enum FlexibilidadHoraria {
  HORA_CONCRETA = 'hora_concreta',
  FLEXIBLE = 'flexible',
  LO_ANTES_POSIBLE = 'lo_antes_posible',
}

export const FLEXIBILIDAD_HORARIA_LABELS: Record<FlexibilidadHoraria, string> = {
  [FlexibilidadHoraria.HORA_CONCRETA]: 'A una hora concreta',
  [FlexibilidadHoraria.FLEXIBLE]: 'Soy flexible',
  [FlexibilidadHoraria.LO_ANTES_POSIBLE]: 'Lo antes posible',
};

/**
 * Franja en la que el cliente flexible acepta que le recojan.
 *
 * No reutiliza la `FranjaHoraria` de funerarios: aquella parte el día en tres
 * tramos cerrados con su horario escrito, y aquí hace falta el mediodía y un
 * «me da igual» que allí no tiene sentido.
 */
export enum FranjaRecogida {
  MANANA = 'manana',
  MEDIODIA = 'mediodia',
  TARDE = 'tarde',
  CUALQUIERA = 'cualquiera',
}

export const FRANJA_RECOGIDA_LABELS: Record<FranjaRecogida, string> = {
  [FranjaRecogida.MANANA]: 'Mañana',
  [FranjaRecogida.MEDIODIA]: 'Mediodía',
  [FranjaRecogida.TARDE]: 'Tarde',
  [FranjaRecogida.CUALQUIERA]: 'Cualquier horario',
};

/** Quién entrega o recibe a la mascota. */
export enum ResponsableEntrega {
  YO = 'yo',
  OTRA_PERSONA = 'otra_persona',
  EMPRESA = 'empresa',
}

export const RESPONSABLE_ENTREGA_LABELS: Record<ResponsableEntrega, string> = {
  [ResponsableEntrega.YO]: 'Yo',
  [ResponsableEntrega.OTRA_PERSONA]: 'Otra persona',
  [ResponsableEntrega.EMPRESA]: 'Una empresa',
};

export enum ConfirmacionEntrega {
  NOTIFICACION = 'notificacion',
  NOTIFICACION_Y_FOTO = 'notificacion_y_foto',
  NO_NECESARIA = 'no_necesaria',
}

export const CONFIRMACION_ENTREGA_LABELS: Record<ConfirmacionEntrega, string> = {
  [ConfirmacionEntrega.NOTIFICACION]: 'Notificación Doogking',
  [ConfirmacionEntrega.NOTIFICACION_Y_FOTO]: 'Notificación + fotografía',
  [ConfirmacionEntrega.NO_NECESARIA]: 'No es necesario',
};

/** Estados del presupuesto pedido cuando no hay precio automático posible. */
export enum EstadoPresupuesto {
  SOLICITADO = 'solicitado',
  OFERTADO = 'ofertado',
  ACEPTADO = 'aceptado',
  RECHAZADO = 'rechazado',
  CADUCADO = 'caducado',
}

export const ESTADO_PRESUPUESTO_LABELS: Record<EstadoPresupuesto, string> = {
  [EstadoPresupuesto.SOLICITADO]: 'Pendiente de respuesta',
  [EstadoPresupuesto.OFERTADO]: 'Presupuesto recibido',
  [EstadoPresupuesto.ACEPTADO]: 'Aceptado',
  [EstadoPresupuesto.RECHAZADO]: 'Rechazado',
  [EstadoPresupuesto.CADUCADO]: 'Caducado',
};

/**
 * Hitos del viaje, en el orden en que ocurren. El seguimiento del cliente no es
 * más que esta lista con los que ya han pasado marcados.
 */
export const HITOS_VIAJE_TRANSPORTE = [
  'reserva_confirmada',
  'transportista_asignado',
  'de_camino',
  'recogida',
  'en_ruta',
  'entregada',
] as const;

export type HitoViajeTransporte = (typeof HITOS_VIAJE_TRANSPORTE)[number];

export const HITO_VIAJE_TRANSPORTE_LABELS: Record<HitoViajeTransporte, string> = {
  reserva_confirmada: 'Reserva confirmada',
  transportista_asignado: 'Transportista asignado',
  de_camino: 'De camino',
  recogida: 'Mascota recogida',
  en_ruta: 'En trayecto',
  entregada: 'Mascota entregada',
};
