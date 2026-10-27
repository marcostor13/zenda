/**
 * La comisión propia de un comercio se guarda como fracción (0.12) y el admin
 * la escribe como porcentaje (12). Convertir en un único sitio evita que un
 * «12» acabe guardado como un 1200 %.
 */

/** Porcentaje escrito → fracción guardada. Vacío es `null`: vuelve a la del vertical. */
export function comisionDesdePorcentaje(porcentaje: number | string | null | undefined): number | null {
  if (porcentaje === null || porcentaje === undefined || porcentaje === '') return null;
  const numero = Number(porcentaje);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100) / 10000;
}

/** Fracción guardada → porcentaje para el campo, con dos decimales como mucho. */
export function porcentajeDesdeComision(comision: number | null | undefined): number | null {
  return comision != null ? Math.round(comision * 10000) / 100 : null;
}
