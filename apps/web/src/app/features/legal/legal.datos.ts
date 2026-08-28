/**
 * Identidad del responsable del tratamiento y datos de contacto que aparecen en
 * los documentos legales.
 *
 * **Están aquí, en un solo sitio, porque hay que rellenarlos antes de publicar.**
 * El RGPD exige identificar al responsable (razón social, identificación fiscal
 * y domicilio) y Meta rechaza la política de privacidad si no lo encuentra. No
 * se inventan: los valores marcados como pendientes salen tal cual en la página
 * para que nadie los dé por buenos por descuido.
 */
export const RESPONSABLE = {
  /** Razón social del titular de la plataforma. */
  razonSocial: '[PENDIENTE: razón social del titular]',
  /** NIF / CIF. */
  identificacionFiscal: '[PENDIENTE: NIF/CIF]',
  /** Domicilio social completo. */
  domicilio: '[PENDIENTE: domicilio social]',
  /** Buzón de privacidad; puede ser el mismo de soporte. */
  emailPrivacidad: 'soporte@doogking.com',
  emailSoporte: 'soporte@doogking.com',
  marca: 'Doogking',
  web: 'https://doogking.com',
} as const;

/** Última revisión del texto; se muestra al pie de cada documento. */
export const ULTIMA_ACTUALIZACION = '28 de agosto de 2026';

/** true si queda algún dato de identidad sin rellenar. */
export const hayDatosPendientes = (): boolean =>
  Object.values(RESPONSABLE).some((valor) => valor.startsWith('[PENDIENTE'));
