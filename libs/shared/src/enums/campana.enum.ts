/**
 * Para qué se lanza una campaña (TCK-8038 §3). Guardarlo permite comparar
 * después qué tipo de campaña funciona mejor.
 */
export enum ObjetivoCampana {
  CAPTACION = 'captacion',
  MAS_RESERVAS = 'mas_reservas',
  REACTIVACION = 'reactivacion',
  PROMOCIONAR_CATEGORIA = 'promocionar_categoria',
  PROMOCIONAR_ZONA = 'promocionar_zona',
  ESTACIONAL = 'estacional',
  FIDELIZACION_ALPHA = 'fidelizacion_alpha',
}

export const OBJETIVO_CAMPANA_LABELS: Record<ObjetivoCampana, string> = {
  [ObjetivoCampana.CAPTACION]: 'Captación de nuevos usuarios',
  [ObjetivoCampana.MAS_RESERVAS]: 'Aumentar reservas',
  [ObjetivoCampana.REACTIVACION]: 'Reactivar clientes inactivos',
  [ObjetivoCampana.PROMOCIONAR_CATEGORIA]: 'Promocionar una categoría',
  [ObjetivoCampana.PROMOCIONAR_ZONA]: 'Promocionar una zona o ciudad',
  [ObjetivoCampana.ESTACIONAL]: 'Campaña estacional',
  [ObjetivoCampana.FIDELIZACION_ALPHA]: 'Fidelización Alpha',
};

/** A quién se dirige la campaña (TCK-8038 §4). */
export enum SegmentoCampana {
  TODOS = 'todos',
  NUEVOS = 'nuevos',
  SIN_RESERVAS = 'sin_reservas',
  RECURRENTES = 'recurrentes',
  INACTIVOS = 'inactivos',
  NIVEL_ALPHA = 'nivel_alpha',
}

export const SEGMENTO_CAMPANA_LABELS: Record<SegmentoCampana, string> = {
  [SegmentoCampana.TODOS]: 'Todos los usuarios',
  [SegmentoCampana.NUEVOS]: 'Usuarios nuevos',
  [SegmentoCampana.SIN_RESERVAS]: 'Registrados sin reservas',
  [SegmentoCampana.RECURRENTES]: 'Clientes recurrentes',
  [SegmentoCampana.INACTIVOS]: 'Usuarios inactivos',
  [SegmentoCampana.NIVEL_ALPHA]: 'Por nivel Alpha',
};
