const MS_POR_MES = 30.44 * 24 * 60 * 60 * 1000;

type Traductor = (textoEs: string, params: Record<string, number>) => string;

/** Sin traductor, sólo se sustituyen las marcas (útil en pruebas y en el API). */
const sinTraducir: Traductor = (texto, params) =>
  texto.replace(/\{(\w+)\}/g, (_, clave: string) => String(params[clave] ?? ''));

/** Edad legible ("8 meses", "3 años") a partir de la fecha de nacimiento. */
export function edadLegible(fechaNacimiento?: string, t: Traductor = sinTraducir): string | null {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const meses = (Date.now() - nacimiento.getTime()) / MS_POR_MES;
  if (meses < 0) return null;
  if (meses < 12) return t('{n} meses', { n: Math.max(1, Math.round(meses)) });
  const anos = Math.floor(meses / 12);
  return anos === 1 ? t('1 año', {}) : t('{n} años', { n: anos });
}

/** Texto sin tildes y en minúsculas, para buscar como escribe la gente. */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}
