import {
  CondicionSuplemento, FormaCalculoSuplemento, ExigenciaRequisito,
} from './transporte.enums';

/** Una opción de un catálogo cerrado: valor que se guarda y texto que se enseña. */
export interface OpcionCatalogo {
  readonly valor: string;
  readonly etiqueta: string;
}

/**
 * Suplementos que una empresa de transporte puede activar.
 *
 * Es un catálogo cerrado a propósito. Con texto libre cada empresa escribiría
 * «Urgencia», «urgente» y «Servicio express» para lo mismo, y el cliente no
 * podría filtrar ni comparar dos ofertas: la lista comparable es la mitad del
 * valor del marketplace. `condicion` es lo que permite al motor aplicarlo solo
 * cuando toca sin preguntar nada al cliente.
 */
export interface DefinicionSuplemento extends OpcionCatalogo {
  readonly condicion: CondicionSuplemento;
  /** Forma de cálculo que se propone al activarlo; la empresa puede cambiarla. */
  readonly formaSugerida: FormaCalculoSuplemento;
}

export const SUPLEMENTOS_TRANSPORTE: readonly DefinicionSuplemento[] = [
  { valor: 'mascota_adicional', etiqueta: 'Mascota adicional', condicion: CondicionSuplemento.MASCOTA_ADICIONAL, formaSugerida: FormaCalculoSuplemento.POR_MASCOTA },
  { valor: 'tamano_peso', etiqueta: 'Tamaño o peso', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'servicio_exclusivo', etiqueta: 'Servicio exclusivo', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'urgencia', etiqueta: 'Urgencia', condicion: CondicionSuplemento.URGENCIA, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'nocturno', etiqueta: 'Horario nocturno', condicion: CondicionSuplemento.NOCTURNO, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'fin_de_semana', etiqueta: 'Fin de semana o festivo', condicion: CondicionSuplemento.FIN_DE_SEMANA, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'espera', etiqueta: 'Tiempo de espera', condicion: CondicionSuplemento.ESPERA, formaSugerida: FormaCalculoSuplemento.POR_HORA },
  { valor: 'parada_adicional', etiqueta: 'Parada adicional', condicion: CondicionSuplemento.PARADA_ADICIONAL, formaSugerida: FormaCalculoSuplemento.POR_PARADA },
  { valor: 'aeropuerto_puerto', etiqueta: 'Aeropuerto o puerto', condicion: CondicionSuplemento.AEROPUERTO_PUERTO, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'transportin_empresa', etiqueta: 'Transportín de la empresa', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'medicacion', etiqueta: 'Administración de medicación', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'gestion_documental', etiqueta: 'Gestión documental', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'pasajero_adicional', etiqueta: 'Pasajero adicional', condicion: CondicionSuplemento.PASAJERO_ADICIONAL, formaSugerida: FormaCalculoSuplemento.POR_PASAJERO },
  { valor: 'equipaje_especial', etiqueta: 'Equipaje especial', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'peaje_ferry', etiqueta: 'Peaje, ferry o aparcamiento', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
  { valor: 'fuera_de_zona', etiqueta: 'Recogida fuera de zona', condicion: CondicionSuplemento.FUERA_DE_ZONA, formaSugerida: FormaCalculoSuplemento.POR_KM },
  { valor: 'puerta_a_puerta', etiqueta: 'Entrega puerta a puerta', condicion: CondicionSuplemento.SIEMPRE, formaSugerida: FormaCalculoSuplemento.IMPORTE_FIJO },
];

/**
 * Especies que puede admitir un transportista, en el orden del alta.
 *
 * El valor es el nombre en singular y con mayúscula porque así lo guardan el
 * resto de verticales y así lo compara `admiteEspecie`: cambiar aquí a una
 * clave interna dejaría fuera a todos los perros con ficha ya creada.
 */
export const ESPECIES_TRANSPORTE: readonly OpcionCatalogo[] = [
  { valor: 'Perro', etiqueta: 'Perros' },
  { valor: 'Gato', etiqueta: 'Gatos' },
  { valor: 'Hurón', etiqueta: 'Hurones' },
  { valor: 'Conejo', etiqueta: 'Conejos' },
  { valor: 'Roedor', etiqueta: 'Roedores y cobayas' },
  { valor: 'Ave', etiqueta: 'Aves' },
  { valor: 'Reptil', etiqueta: 'Reptiles' },
  { valor: 'Pez', etiqueta: 'Peces y animales acuáticos' },
  { valor: 'Otro', etiqueta: 'Otros, con aprobación previa' },
];

/**
 * Tramos de peso del transporte.
 *
 * No se reutiliza la escala de tamaños de perro porque aquí también viajan
 * gatos, conejos y aves: lo que importa es el peso que ocupa un transportín,
 * no si el perro es «mediano».
 */
export const TRAMOS_PESO_TRANSPORTE: readonly OpcionCatalogo[] = [
  { valor: 'hasta_5', etiqueta: 'Hasta 5 kg' },
  { valor: '5_10', etiqueta: 'De 5 a 10 kg' },
  { valor: '10_25', etiqueta: 'De 10 a 25 kg' },
  { valor: '25_40', etiqueta: 'De 25 a 40 kg' },
  { valor: 'mas_40', etiqueta: 'Más de 40 kg' },
];

/**
 * Situaciones en las que la empresa quiere mirar la reserva antes de aceptarla.
 *
 * No bloquean: convierten la reserva inmediata en una que espera confirmación,
 * que es lo que pide quien transporta un animal reactivo o medicado.
 */
export const SITUACIONES_CONFIRMACION: readonly OpcionCatalogo[] = [
  { valor: 'medicacion', etiqueta: 'Medicación' },
  { valor: 'movilidad_reducida', etiqueta: 'Movilidad reducida' },
  { valor: 'conducta_reactiva', etiqueta: 'Conducta reactiva' },
  { valor: 'bozal', etiqueta: 'Bozal' },
  { valor: 'manejo_especial', etiqueta: 'Perro de manejo especial' },
  { valor: 'gestacion', etiqueta: 'Gestación' },
  { valor: 'celo', etiqueta: 'Celo' },
  { valor: 'condicion_medica', etiqueta: 'Condición médica' },
  { valor: 'valoracion_previa', etiqueta: 'Valoración previa' },
];

/** Equipamiento del vehículo. Es lo que el cliente compara entre dos ofertas. */
export const EQUIPAMIENTO_VEHICULO: readonly OpcionCatalogo[] = [
  { valor: 'climatizacion', etiqueta: 'Climatización y ventilación' },
  { valor: 'habitaculos', etiqueta: 'Habitáculos o jaulas fijadas' },
  { valor: 'anclajes', etiqueta: 'Anclajes para arnés' },
  { valor: 'separacion', etiqueta: 'Separación entre animales' },
  { valor: 'gps', etiqueta: 'GPS o ubicación en directo' },
  { valor: 'camara', etiqueta: 'Cámara o reportes' },
  { valor: 'emergencia', etiqueta: 'Agua y material de emergencia' },
  { valor: 'rampa', etiqueta: 'Rampa de acceso' },
  { valor: 'desinfeccion', etiqueta: 'Limpieza y desinfección' },
];

/** Tipos de equipaje que admite el vehículo cuando viaja el responsable. */
export const EQUIPAJE_TRANSPORTE: readonly OpcionCatalogo[] = [
  { valor: 'sin_equipaje', etiqueta: 'Sin equipaje' },
  { valor: 'bolso', etiqueta: 'Bolso o mochila' },
  { valor: 'maleta', etiqueta: 'Maleta' },
  { valor: 'varias_maletas', etiqueta: 'Varias maletas' },
  { valor: 'transportin_grande', etiqueta: 'Transportín grande' },
];

/**
 * Documentación que se le puede exigir a la mascota.
 *
 * `exigencia` la fija la empresa al activarla; aquí solo se propone lo
 * razonable, para que activar «pasaporte europeo» no obligue a un viaje entre
 * dos calles del mismo pueblo.
 */
export interface DefinicionRequisito extends OpcionCatalogo {
  readonly exigenciaSugerida: ExigenciaRequisito;
}

export const REQUISITOS_DOCUMENTALES: readonly DefinicionRequisito[] = [
  { valor: 'ficha_doogking', etiqueta: 'Ficha Doogking de la mascota', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
  { valor: 'microchip', etiqueta: 'Número de microchip', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
  { valor: 'vacunas', etiqueta: 'Vacunas al día', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
  { valor: 'antirrabica', etiqueta: 'Vacuna antirrábica', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
  { valor: 'pasaporte', etiqueta: 'Pasaporte europeo', exigenciaSugerida: ExigenciaRequisito.INTERNACIONAL },
  { valor: 'certificado_salud', etiqueta: 'Certificado veterinario de salud', exigenciaSugerida: ExigenciaRequisito.SEGUN_DESTINO },
  { valor: 'traces', etiqueta: 'Certificado de movimiento intracomunitario', exigenciaSugerida: ExigenciaRequisito.INTERNACIONAL },
  { valor: 'pauta_medicacion', etiqueta: 'Pauta de medicación', exigenciaSugerida: ExigenciaRequisito.OPCIONAL },
  { valor: 'declaracion_conducta', etiqueta: 'Declaración de conducta', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
  { valor: 'autorizacion_propietario', etiqueta: 'Autorización del propietario', exigenciaSugerida: ExigenciaRequisito.MASCOTA_SOLA },
  { valor: 'datos_receptor', etiqueta: 'Datos de la persona receptora', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
  { valor: 'contacto_emergencia', etiqueta: 'Contacto de emergencia', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
  { valor: 'condiciones_transporte', etiqueta: 'Aceptación de condiciones de transporte', exigenciaSugerida: ExigenciaRequisito.SIEMPRE },
];

/**
 * Documentación profesional de la empresa. Se guarda una sola vez en Mi negocio
 * y se reutiliza en todos sus servicios de transporte: pedirla por servicio
 * llevaría a subir el mismo seguro cinco veces.
 */
export interface DocumentoProfesional extends OpcionCatalogo {
  /** `true` si su ausencia bloquea la publicación en cualquier caso. */
  readonly obligatorio: boolean;
  readonly nota: string;
}

export const DOCUMENTOS_PROFESIONALES: readonly DocumentoProfesional[] = [
  { valor: 'identidad_fiscal', etiqueta: 'Identidad y datos fiscales', obligatorio: true, nota: 'Obligatorio' },
  { valor: 'autorizacion_transportista', etiqueta: 'Autorización y código de transportista', obligatorio: false, nota: 'Según actividad' },
  { valor: 'formacion', etiqueta: 'Formación del conductor o cuidador', obligatorio: false, nota: 'Según actividad' },
  { valor: 'seguro', etiqueta: 'Seguro correspondiente', obligatorio: true, nota: 'Obligatorio' },
  { valor: 'vehiculos', etiqueta: 'Vehículos y documentación aplicable', obligatorio: true, nota: 'Obligatorio' },
  { valor: 'plan_contingencia', etiqueta: 'Plan de contingencia', obligatorio: true, nota: 'Obligatorio' },
  { valor: 'transporte_personas', etiqueta: 'Autorización para transportar personas', obligatorio: false, nota: 'Si viaja el responsable' },
];

/**
 * Necesidades que puede declarar el cliente sobre su mascota.
 *
 * Algunas cambian el precio (transportín de la empresa) y otras solo avisan al
 * conductor, pero todas se preguntan en el mismo sitio: el dueño no tiene por
 * qué saber cuál de ellas cuesta dinero.
 */
export const NECESIDADES_MASCOTA: readonly OpcionCatalogo[] = [
  { valor: 'transportin', etiqueta: 'Transportín' },
  { valor: 'jaula', etiqueta: 'Jaula' },
  { valor: 'arnes', etiqueta: 'Arnés' },
  { valor: 'medicacion', etiqueta: 'Medicación' },
  { valor: 'movilidad_reducida', etiqueta: 'Movilidad reducida' },
  { valor: 'animal_mayor', etiqueta: 'Animal mayor' },
  { valor: 'cachorro', etiqueta: 'Cachorro' },
  { valor: 'separado', etiqueta: 'Separado de otros animales' },
  { valor: 'acompanamiento', etiqueta: 'Acompañamiento especial' },
];

/** Cómo se porta la mascota en el coche. Lo necesita el conductor, no el precio. */
export const COMPORTAMIENTOS_MASCOTA: readonly OpcionCatalogo[] = [
  { valor: 'tranquilo', etiqueta: 'Tranquilo' },
  { valor: 'algo_nervioso', etiqueta: 'Algo nervioso' },
  { valor: 'miedo_coche', etiqueta: 'Miedo al coche' },
  { valor: 'reactivo_perros', etiqueta: 'Reactivo con perros' },
  { valor: 'reactivo_personas', etiqueta: 'Reactivo con personas' },
  { valor: 'no_lo_se', etiqueta: 'No lo sé' },
];

/**
 * Preferencias del viaje que el cliente puede pedir.
 *
 * Coinciden en clave con el equipamiento del vehículo y con los suplementos a
 * petición: así marcar «foto durante el trayecto» sirve a la vez para filtrar
 * transportistas que lo ofrecen y para sumar su suplemento si lo cobran.
 */
export const PREFERENCIAS_VIAJE: readonly OpcionCatalogo[] = [
  { valor: 'climatizacion', etiqueta: 'Climatización' },
  { valor: 'gps', etiqueta: 'Seguimiento del viaje' },
  { valor: 'aviso_recogida', etiqueta: 'Aviso de recogida' },
  { valor: 'aviso_entrega', etiqueta: 'Aviso de entrega' },
  { valor: 'camara', etiqueta: 'Foto durante el trayecto' },
  { valor: 'transportin_empresa', etiqueta: 'Transportín incluido' },
  { valor: 'servicio_exclusivo', etiqueta: 'Viaje exclusivo' },
  { valor: 'conductor_especializado', etiqueta: 'Conductor especializado' },
];

/** Busca la etiqueta de un valor en cualquiera de los catálogos de arriba. */
export function etiquetaDe(catalogo: readonly OpcionCatalogo[], valor: string): string {
  return catalogo.find((o) => o.valor === valor)?.etiqueta ?? valor;
}
