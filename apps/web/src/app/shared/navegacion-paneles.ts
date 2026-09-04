/**
 * Secciones de los paneles de comercio y de administración.
 *
 * Viven aquí y no dentro de cada layout porque las pintan **dos** sitios: la
 * columna lateral del panel en escritorio y el menú hamburguesa en móvil. Con
 * la lista duplicada, añadir una sección obligaba a acordarse de tocar los dos
 * y el menú del móvil se quedaba corto sin que nadie lo notara.
 *
 * Es sólo datos —sin dependencias de Angular— para que la navbar pueda
 * importarlo sin arrastrar los módulos de los paneles ni crear un ciclo.
 */

export interface SeccionPanel {
  readonly icon: string;
  readonly label: string;
  readonly ruta: string;
  /** `true` sólo en la raíz del panel, que si no queda siempre marcada. */
  readonly exact: boolean;
}

export interface GrupoPanel {
  readonly title: string;
  readonly items: readonly SeccionPanel[];
}

/** Panel de comercio: una sola lista, son once entradas sin jerarquía. */
export const NAV_COMERCIO: readonly SeccionPanel[] = [
  { icon: 'sparkles',     label: 'Inicio',               ruta: '/comercio',             exact: true  },
  { icon: 'calendar',     label: 'Reservas',             ruta: '/comercio/reservas',    exact: false },
  { icon: 'calendar',     label: 'Agenda',               ruta: '/comercio/agenda',      exact: false },
  { icon: 'tag',          label: 'Servicios',            ruta: '/comercio/listados',    exact: false },
  { icon: 'euro',         label: 'Extras y suplementos', ruta: '/comercio/suplementos', exact: false },
  { icon: 'trending-up',  label: 'Ingresos y pagos',     ruta: '/comercio/ingresos',    exact: false },
  { icon: 'star',         label: 'Reseñas',              ruta: '/comercio/resenas',     exact: false },
  { icon: 'users',        label: 'Equipo',               ruta: '/comercio/equipo',      exact: false },
  { icon: 'sparkles',     label: 'Suscripción',          ruta: '/comercio/suscripcion', exact: false },
  { icon: 'settings',     label: 'Configuración',        ruta: '/comercio/config',      exact: false },
  { icon: 'alert-circle', label: 'Estado de la cuenta',  ruta: '/comercio/cuenta',      exact: false },
];

/** Panel de administración: dieciocho entradas, agrupadas para poder leerlas. */
export const NAV_ADMIN: readonly GrupoPanel[] = [
  {
    title: 'Visión general',
    items: [
      { icon: 'sparkles',    label: 'Dashboard',       ruta: '/admin',               exact: true  },
      { icon: 'trending-up', label: 'Analítica',       ruta: '/admin/analitica',     exact: false },
      { icon: 'euro',        label: 'Reportes',        ruta: '/admin/reportes',      exact: false },
      { icon: 'banknote',    label: 'Pagos',           ruta: '/admin/pagos',         exact: false },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { icon: 'building',     label: 'Comercios',    ruta: '/admin/comercios',    exact: false },
      { icon: 'shield',       label: 'Aseguradoras', ruta: '/admin/seguros',      exact: false },
      { icon: 'users',        label: 'Usuarios',     ruta: '/admin/usuarios',     exact: false },
      { icon: 'calendar',     label: 'Reservas',     ruta: '/admin/reservas',     exact: false },
      { icon: 'star',         label: 'Reseñas',      ruta: '/admin/resenas',      exact: false },
      { icon: 'alert-circle', label: 'Incidencias',  ruta: '/admin/incidencias',  exact: false },
    ],
  },
  {
    title: 'Plataforma',
    items: [
      { icon: 'tag',     label: 'Cupones',         ruta: '/admin/cupones',   exact: false },
      { icon: 'percent', label: 'Campañas',        ruta: '/admin/campanas',  exact: false },
      { icon: 'map-pin', label: 'Comunidad',       ruta: '/admin/comunidad', exact: false },
      { icon: 'bell',    label: 'Notificaciones',  ruta: '/admin/avisos',    exact: false },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { icon: 'percent',  label: 'Comisiones',      ruta: '/admin/comisiones',    exact: false },
      { icon: 'crown',    label: 'Doogking Alpha',  ruta: '/admin/alpha',         exact: false },
      { icon: 'clock',    label: 'Historial',       ruta: '/admin/auditoria',     exact: false },
      { icon: 'settings', label: 'Ajustes',         ruta: '/admin/configuracion', exact: false },
    ],
  },
];
