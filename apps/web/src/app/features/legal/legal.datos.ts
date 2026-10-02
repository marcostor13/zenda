/**
 * Identidad del titular de la plataforma y datos de contacto que aparecen en
 * los documentos legales.
 *
 * Están en un solo sitio porque los exigen a la vez el artículo 10 de la LSSI-CE
 * (aviso legal), el RGPD (identificar al responsable del tratamiento) y Meta
 * para aprobar el inicio de sesión social.
 *
 * Sólo datos de la empresa: nada de domicilios particulares ni fechas de
 * nacimiento de las personas (LOPDGDD). Cuando Hacienda asigne el NIF y la
 * sociedad quede inscrita, se actualizan aquí `identificacionFiscal` y
 * `razonSocial`, y la fecha de `ULTIMA_ACTUALIZACION`.
 */
export const RESPONSABLE = {
  /** Razón social del titular de la plataforma. */
  razonSocial: 'DOOGKING, S.L. (EN CONSTITUCIÓN)',
  /** NIF; la clave se traduce con el pipe `t`. */
  identificacionFiscal: 'NIF en trámite (pendiente de asignación)',
  /** Domicilio social completo (sin el país, que va aparte para traducirlo). */
  domicilio: 'Calle Doctor Roux, 10, Bajo, 12004 Castellón de la Plana (Castellón)',
  pais: 'España',
  /** Buzón de privacidad; es el mismo que el de contacto general. */
  emailPrivacidad: 'info@doogking.com',
  emailSoporte: 'info@doogking.com',
  marca: 'Doogking',
  web: 'https://doogking.com',
  /** Persona de contacto que representa a la sociedad ante usuarios y autoridades. */
  representante: {
    nombre: 'Alexandra Miguelina Germán Evangelista',
    cargo: 'Socia fundadora',
  },
  administrador: 'Edgar Benedicto Tormos',
} as const;

/** Última revisión del texto; se muestra (traducida) al pie de cada documento. */
export const ULTIMA_ACTUALIZACION = '2 de octubre de 2026';
