/**
 * Catálogo **cerrado** de servicios veterinarios reservables en Doogking.
 *
 * Regla de oro (veterinarios.md): *si el veterinario no puede saber cuánto va a
 * pagar el cliente antes de acudir a la clínica, no debería aparecer como
 * servicio de contratación directa*. De ahí que el catálogo liste actos
 * concretos con precio cerrado o calculable —una vacuna, una castración por
 * tramo de peso— y no especialidades («cardiología», «dermatología»), que
 * describen a quién ves pero no lo que cuesta.
 *
 * Eso no cierra la puerta a una especialidad: una clínica puede publicar
 * «Primera consulta de cardiología — 70 €» con {@link ServicioClinicoTipo.OTRO},
 * porque lo que se compra ahí es la consulta, no el tratamiento.
 */
export enum ServicioClinicoTipo {
  CONSULTA_GENERAL = 'consulta_general',
  CONSULTA_REVISION = 'consulta_revision',
  VACUNACION = 'vacunacion',
  DESPARASITACION_INTERNA = 'desparasitacion_interna',
  DESPARASITACION_EXTERNA = 'desparasitacion_externa',
  MICROCHIP = 'microchip',
  PASAPORTE_MASCOTAS = 'pasaporte_mascotas',
  ANALITICA_BASICA = 'analitica_basica',
  ANALITICA_PREOPERATORIA = 'analitica_preoperatoria',
  HIGIENE_DENTAL = 'higiene_dental',
  CASTRACION = 'castracion',
  ESTERILIZACION = 'esterilizacion',
  CORTE_UNAS = 'corte_unas',
  LIMPIEZA_OIDOS = 'limpieza_oidos',
  CURA_HERIDA = 'cura_herida',
  CERTIFICADO_VETERINARIO = 'certificado_veterinario',
  DOCUMENTACION_VIAJE = 'documentacion_viaje',
  TEST_LEISHMANIA = 'test_leishmania',
  TEST_VECTORIALES = 'test_vectoriales',
  CHEQUEO_PREVENTIVO = 'chequeo_preventivo',

  /** Procedimiento tarifado que la clínica tiene y el catálogo no contempla. */
  OTRO = 'otro',

  // --- Heredados: siguen siendo válidos para no romper lo ya publicado, pero
  // no se ofrecen en la rejilla de alta. Urgencias es hoy una casilla del
  // servicio, no un servicio aparte.
  CONSULTA_URGENTE = 'consulta_urgente',
  SEGUNDA_OPINION = 'segunda_opinion',
  TELECONSULTA = 'teleconsulta',
}

/** Cómo se le pone precio a un servicio del catálogo. */
export enum ModoPrecioClinico {
  /** Un único importe: la consulta cuesta lo que cuesta. */
  FIJO = 'fijo',
  /** Un importe por tramo de peso: una castración de 8 kg no vale lo de una de 35. */
  POR_PESO = 'por_peso',
  /** Un importe por variante: la vacuna de la rabia no vale lo que la polivalente. */
  POR_VARIANTE = 'por_variante',
  /** Precio cerrado de un pack de revisión. */
  PACK = 'pack',
}

/** Una entrada de la rejilla de servicios del alta veterinaria. */
export interface ServicioClinicoCatalogo {
  readonly tipo: ServicioClinicoTipo;
  readonly label: string;
  /** Cómo se cobra, en dos palabras: es lo que resuelve la duda al elegir. */
  readonly base: string;
  /** Icono `rs-icon` de la tarjeta. */
  readonly icono: string;
  /** Formas de poner precio admitidas; la primera es la de partida. */
  readonly modosPrecio: readonly ModoPrecioClinico[];
  /** Variantes propuestas cuando se cobra por variante o por tramo de peso. */
  readonly variantes?: readonly string[];
  /**
   * El servicio pide decir qué entra y qué no. Cierto en cirugías y packs: sin
   * eso, el cliente no sabe si el precio incluye la analítica previa.
   */
  readonly detallaAlcance?: boolean;
}

/** Tramos de peso de partida para lo que se cobra según el tamaño del animal. */
export const TRAMOS_PESO_CLINICO: readonly string[] = [
  'Hasta 10 kg', '10–20 kg', '20–30 kg', 'Más de 30 kg',
];

/** Vacunas más habituales; la clínica añade las suyas si le falta alguna. */
export const VACUNAS_HABITUALES: readonly string[] = [
  'Rabia', 'Polivalente', 'Tos de las perreras', 'Leishmania',
];

/**
 * Los servicios que se ofrecen en el alta, en el orden en que se enseñan.
 *
 * El orden no es alfabético a propósito: arriba lo que casi toda clínica vende
 * (consulta, vacuna, desparasitación) y abajo lo ocasional, para que la mayoría
 * termine sin bajar por la rejilla.
 */
export const SERVICIO_CLINICO_CATALOGO: readonly ServicioClinicoCatalogo[] = [
  { tipo: ServicioClinicoTipo.CONSULTA_GENERAL, label: 'Consulta veterinaria',
    base: 'Precio fijo', icono: 'stethoscope', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.CONSULTA_REVISION, label: 'Primera consulta / revisión',
    base: 'Precio fijo', icono: 'dog', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.VACUNACION, label: 'Vacunación',
    base: 'Por tipo de vacuna', icono: 'syringe',
    modosPrecio: [ModoPrecioClinico.POR_VARIANTE], variantes: VACUNAS_HABITUALES },
  { tipo: ServicioClinicoTipo.DESPARASITACION_INTERNA, label: 'Desparasitación interna',
    base: 'Fijo o según peso', icono: 'pill',
    modosPrecio: [ModoPrecioClinico.FIJO, ModoPrecioClinico.POR_PESO], variantes: TRAMOS_PESO_CLINICO },
  { tipo: ServicioClinicoTipo.DESPARASITACION_EXTERNA, label: 'Desparasitación externa',
    base: 'Según peso o producto', icono: 'shield',
    modosPrecio: [ModoPrecioClinico.POR_PESO, ModoPrecioClinico.FIJO], variantes: TRAMOS_PESO_CLINICO },
  { tipo: ServicioClinicoTipo.MICROCHIP, label: 'Implantación de microchip',
    base: 'Precio fijo', icono: 'radio-tower', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.PASAPORTE_MASCOTAS, label: 'Pasaporte para mascotas',
    base: 'Precio fijo', icono: 'file-text', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.ANALITICA_BASICA, label: 'Analítica básica',
    base: 'Precio fijo', icono: 'droplet', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.ANALITICA_PREOPERATORIA, label: 'Analítica preoperatoria',
    base: 'Precio fijo', icono: 'clipboard-list', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.HIGIENE_DENTAL, label: 'Limpieza dental',
    base: 'Fijo o según peso', icono: 'smile',
    modosPrecio: [ModoPrecioClinico.FIJO, ModoPrecioClinico.POR_PESO], variantes: TRAMOS_PESO_CLINICO },
  { tipo: ServicioClinicoTipo.CASTRACION, label: 'Castración de macho',
    base: 'Según especie y peso', icono: 'scissors',
    modosPrecio: [ModoPrecioClinico.POR_PESO], variantes: TRAMOS_PESO_CLINICO, detallaAlcance: true },
  { tipo: ServicioClinicoTipo.ESTERILIZACION, label: 'Esterilización de hembra',
    base: 'Según especie y peso', icono: 'scissors',
    modosPrecio: [ModoPrecioClinico.POR_PESO], variantes: TRAMOS_PESO_CLINICO, detallaAlcance: true },
  { tipo: ServicioClinicoTipo.CORTE_UNAS, label: 'Corte de uñas',
    base: 'Precio fijo', icono: 'paw', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.LIMPIEZA_OIDOS, label: 'Limpieza de oídos',
    base: 'Precio fijo', icono: 'waves', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.CURA_HERIDA, label: 'Cura / revisión de herida',
    base: 'Precio fijo', icono: 'shield-check', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.CERTIFICADO_VETERINARIO, label: 'Certificado veterinario',
    base: 'Precio fijo', icono: 'badge-check', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.DOCUMENTACION_VIAJE, label: 'Documentación para viaje',
    base: 'Precio fijo', icono: 'plane', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.TEST_LEISHMANIA, label: 'Test de Leishmania',
    base: 'Precio fijo', icono: 'search', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.TEST_VECTORIALES, label: 'Test de enfermedades vectoriales',
    base: 'Precio fijo', icono: 'search', modosPrecio: [ModoPrecioClinico.FIJO] },
  { tipo: ServicioClinicoTipo.CHEQUEO_PREVENTIVO, label: 'Chequeo preventivo',
    base: 'Pack de revisión', icono: 'heart',
    modosPrecio: [ModoPrecioClinico.PACK], detallaAlcance: true },
];

export const SERVICIO_CLINICO_LABELS: Record<ServicioClinicoTipo, string> = {
  ...Object.fromEntries(SERVICIO_CLINICO_CATALOGO.map((s) => [s.tipo, s.label])),
  [ServicioClinicoTipo.OTRO]: 'Otro servicio',
  [ServicioClinicoTipo.CONSULTA_URGENTE]: 'Urgencia',
  [ServicioClinicoTipo.SEGUNDA_OPINION]: 'Segunda opinión',
  [ServicioClinicoTipo.TELECONSULTA]: 'Teleconsulta',
} as Record<ServicioClinicoTipo, string>;

/**
 * Nombres con los que estos servicios se guardaron antes de tener catálogo.
 *
 * Sirve para reconocerlos al editar un listado antiguo: sin esto, un servicio
 * escrito a mano como «Consulta general» dejaría de encontrarse al renombrar la
 * etiqueta y el comercio lo vería desaparecer de su ficha.
 */
export const SERVICIO_CLINICO_SINONIMOS: Readonly<Record<string, ServicioClinicoTipo>> = {
  'consulta general': ServicioClinicoTipo.CONSULTA_GENERAL,
  'consulta de revision': ServicioClinicoTipo.CONSULTA_REVISION,
  'primera consulta': ServicioClinicoTipo.CONSULTA_REVISION,
  'higiene dental': ServicioClinicoTipo.HIGIENE_DENTAL,
  'castracion': ServicioClinicoTipo.CASTRACION,
  'esterilizacion': ServicioClinicoTipo.ESTERILIZACION,
  'implantacion de microchip': ServicioClinicoTipo.MICROCHIP,
  'urgencia': ServicioClinicoTipo.CONSULTA_URGENTE,
  'segunda opinion': ServicioClinicoTipo.SEGUNDA_OPINION,
  'teleconsulta': ServicioClinicoTipo.TELECONSULTA,
};

/**
 * Lo que **no** se publica como servicio de contratación directa.
 *
 * Son especialidades, no actos tarifados: describen a quién ves, no lo que
 * cuesta, y el cliente no puede saber el importe antes de ir. Se listan
 * explícitamente para poder dar un mensaje útil al comercio —«publica la
 * primera consulta de cardiología, no la cardiología»— en vez de un genérico
 * "valor no permitido".
 */
export const SERVICIOS_CLINICOS_EXCLUIDOS = [
  'cardiologia', 'cardiología', 'neurologia', 'neurología',
  'oncologia', 'oncología', 'endocrinologia', 'endocrinología',
  'traumatologia', 'traumatología', 'dermatologia', 'dermatología',
  'oftalmologia', 'oftalmología', 'etologia', 'etología',
  'medicina interna', 'fisioterapia', 'rehabilitacion', 'rehabilitación',
  'diagnostico por imagen', 'diagnóstico por imagen',
  'cirugia', 'cirugía',
] as const;

/**
 * `true` si el texto es una especialidad suelta y no un acto con precio.
 *
 * Se mira el nombre entero y no una parte: «Primera consulta de cardiología» sí
 * se puede publicar —lo que se compra es la consulta— y «Cardiología» no.
 */
export function esEspecialidadSuelta(nombre: string): boolean {
  const limpio = nombre.trim().toLowerCase();
  return SERVICIOS_CLINICOS_EXCLUIDOS.some((excluido) => limpio === excluido);
}
