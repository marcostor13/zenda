/**
 * Áreas del panel administrativo. Una persona de soporte no tiene por qué poder
 * tocar comisiones o liquidaciones (TCK-8040 §7 y TCK-8035 §7).
 */
export enum PermisoAdmin {
  FINANZAS = 'finanzas',
  COMERCIOS = 'comercios',
  USUARIOS = 'usuarios',
  SOPORTE = 'soporte',
  MARKETING = 'marketing',
  CONFIGURACION = 'configuracion',
}

export const PERMISO_ADMIN_LABELS: Record<PermisoAdmin, string> = {
  [PermisoAdmin.FINANZAS]: 'Finanzas',
  [PermisoAdmin.COMERCIOS]: 'Comercios',
  [PermisoAdmin.USUARIOS]: 'Usuarios',
  [PermisoAdmin.SOPORTE]: 'Soporte',
  [PermisoAdmin.MARKETING]: 'Marketing',
  [PermisoAdmin.CONFIGURACION]: 'Configuración',
};

export const PERMISO_ADMIN_DESCRIPCIONES: Record<PermisoAdmin, string> = {
  [PermisoAdmin.FINANZAS]: 'Reportes, pagos, liquidaciones y comisiones.',
  [PermisoAdmin.COMERCIOS]: 'Alta, aprobación, verificación y suspensión de comercios.',
  [PermisoAdmin.USUARIOS]: 'Cuentas de clientes y de personal.',
  [PermisoAdmin.SOPORTE]: 'Reservas, incidencias y reseñas.',
  [PermisoAdmin.MARKETING]: 'Cupones, campañas y comunidad.',
  [PermisoAdmin.CONFIGURACION]: 'Comisiones, programa Alpha y ajustes de plataforma.',
};

/**
 * Un administrador sin permisos declarados es un superadministrador: es lo que
 * eran todos antes de que existieran los permisos, y cambiarlo en silencio
 * dejaría al equipo fuera de su propio panel.
 */
export function tienePermisoAdmin(permisos: PermisoAdmin[] | undefined, requerido: PermisoAdmin): boolean {
  if (!permisos || permisos.length === 0) return true;
  return permisos.includes(requerido);
}
