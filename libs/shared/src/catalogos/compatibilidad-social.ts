/**
 * Perfiles de compatibilidad social de un perro en una residencia canina.
 *
 * Hasta octubre de 2026 el comercio marcaba los perfiles que **admitía**
 * (`compatibilidadSocialAdmitida`, vacío = admite cualquiera). Ahora marca los
 * que **no admite** (`compatibilidadSocialNoAdmitida`, vacío = admite
 * cualquiera), que es lo natural para un centro: "aquí no entran perros que
 * necesitan alojamiento individual".
 *
 * Las fichas guardadas con el modelo antiguo no se migran: se leen con
 * `perfilesSocialesNoAdmitidos`, que traduce la lista de admitidos a su
 * complemento. En cuanto el comercio guarda la ficha, se escribe el campo
 * nuevo y el antiguo queda vacío.
 */
export const PERFILES_COMPATIBILIDAD_SOCIAL = [
  'cualquiera',
  'solo_pequenos',
  'solo_machos',
  'solo_hembras',
  'individual',
] as const;

export type PerfilCompatibilidadSocial = (typeof PERFILES_COMPATIBILIDAD_SOCIAL)[number];

/** Etiqueta (clave de traducción) de cada perfil, vista desde el centro. */
export const PERFIL_COMPATIBILIDAD_SOCIAL_LABELS: Readonly<Record<PerfilCompatibilidadSocial, string>> = {
  cualquiera: 'Compatible con otros perros',
  solo_pequenos: 'Solo con perros pequeños',
  solo_machos: 'Solo con machos',
  solo_hembras: 'Solo con hembras',
  individual: 'Necesita alojamiento individual',
};

export interface CompatibilidadSocialServicio {
  compatibilidadSocialNoAdmitida?: readonly string[] | null;
  /** Modelo anterior (lista de admitidos). Sólo se lee para fichas sin migrar. */
  compatibilidadSocialAdmitida?: readonly string[] | null;
}

/**
 * Perfiles que el centro NO admite. El campo nuevo manda siempre que exista
 * (aunque esté vacío: "no excluyo nada" es una respuesta). Si sólo está el
 * antiguo con contenido, se devuelve su complemento.
 */
export function perfilesSocialesNoAdmitidos(servicio: CompatibilidadSocialServicio | null | undefined): string[] {
  if (!servicio) return [];
  if (Array.isArray(servicio.compatibilidadSocialNoAdmitida)) return [...servicio.compatibilidadSocialNoAdmitida];
  const admitidos = servicio.compatibilidadSocialAdmitida ?? [];
  if (!admitidos.length) return [];
  return PERFILES_COMPATIBILIDAD_SOCIAL.filter((p) => !admitidos.includes(p));
}

/** ¿Admite el centro un perro con este perfil? Un perfil vacío o desconocido no bloquea. */
export function admitePerfilSocial(
  servicio: CompatibilidadSocialServicio | null | undefined,
  perfil: string | null | undefined,
): boolean {
  if (!perfil) return true;
  return !perfilesSocialesNoAdmitidos(servicio).includes(perfil);
}
