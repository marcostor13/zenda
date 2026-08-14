/**
 * Áreas del panel del comercio. Separan lo que alguien **hace** (su puesto) de
 * lo que **puede tocar** (su acceso), que es justo lo que pedía TCK-8026/8027.
 */
export enum PermisoComercio {
  RESERVAS = 'reservas',
  SERVICIOS = 'servicios',
  INGRESOS = 'ingresos',
  RESENAS = 'resenas',
  EQUIPO = 'equipo',
  CONFIGURACION = 'configuracion',
}

export const PERMISO_COMERCIO_LABELS: Record<PermisoComercio, string> = {
  [PermisoComercio.RESERVAS]: 'Reservas',
  [PermisoComercio.SERVICIOS]: 'Servicios',
  [PermisoComercio.INGRESOS]: 'Ingresos y pagos',
  [PermisoComercio.RESENAS]: 'Reseñas',
  [PermisoComercio.EQUIPO]: 'Equipo',
  [PermisoComercio.CONFIGURACION]: 'Configuración',
};

export const PERMISO_COMERCIO_DESCRIPCIONES: Record<PermisoComercio, string> = {
  [PermisoComercio.RESERVAS]: 'Ver y gestionar las reservas que entran.',
  [PermisoComercio.SERVICIOS]: 'Crear, editar y pausar servicios.',
  [PermisoComercio.INGRESOS]: 'Ver la facturación y las liquidaciones.',
  [PermisoComercio.RESENAS]: 'Leer y responder opiniones.',
  [PermisoComercio.EQUIPO]: 'Dar de alta y gestionar compañeros.',
  [PermisoComercio.CONFIGURACION]: 'Editar el perfil y los datos del negocio.',
};

/** Estado de un miembro del equipo, tal y como se lee en el panel. */
export enum EstadoMiembroEquipo {
  ACTIVO = 'activo',
  INVITACION_PENDIENTE = 'invitacion_pendiente',
  DESACTIVADO = 'desactivado',
}

export const ESTADO_MIEMBRO_LABELS: Record<EstadoMiembroEquipo, string> = {
  [EstadoMiembroEquipo.ACTIVO]: 'Activo',
  [EstadoMiembroEquipo.INVITACION_PENDIENTE]: 'Invitación pendiente',
  [EstadoMiembroEquipo.DESACTIVADO]: 'Desactivado',
};
