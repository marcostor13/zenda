import { VerticalKey } from '../enums/vertical.enum';

/**
 * Registro de servicio: lo que el profesional anota en la ficha del perro tras
 * atenderlo (consulta, sesión de peluquería, clase de adiestramiento).
 *
 * Una sola definición de los campos para el formulario del panel, la ficha que
 * ve el dueño y el informe PDF: si cada uno tuviera su lista, un campo nuevo
 * saldría en el formulario y se perdería en el PDF sin que nadie lo notara.
 */

export type TipoCampoRegistro = 'texto' | 'textoLargo' | 'numero';

export interface CampoRegistro {
  readonly clave: string;
  readonly etiqueta: string;
  readonly tipo: TipoCampoRegistro;
  readonly unidad?: string;
  readonly placeholder?: string;
}

/** Categorías en las que el comercio lleva historial de lo que hizo en cada servicio. */
export const VERTICALES_CON_HISTORIAL: readonly VerticalKey[] = [
  VerticalKey.VETERINARIA,
  VerticalKey.PELUQUERIA,
  VerticalKey.ADIESTRAMIENTO,
];

export const CAMPOS_REGISTRO_SERVICIO: Readonly<Partial<Record<VerticalKey, readonly CampoRegistro[]>>> = {
  [VerticalKey.VETERINARIA]: [
    { clave: 'motivo', etiqueta: 'Motivo de la consulta', tipo: 'texto', placeholder: 'Ej. revisión anual, cojera…' },
    { clave: 'exploracion', etiqueta: 'Exploración', tipo: 'textoLargo' },
    { clave: 'diagnostico', etiqueta: 'Diagnóstico', tipo: 'textoLargo' },
    { clave: 'tratamiento', etiqueta: 'Tratamiento', tipo: 'textoLargo' },
    { clave: 'medicacion', etiqueta: 'Medicación pautada', tipo: 'textoLargo', placeholder: 'Fármaco, dosis y duración' },
    { clave: 'vacunas', etiqueta: 'Vacunas aplicadas', tipo: 'texto' },
    { clave: 'pesoKg', etiqueta: 'Peso', tipo: 'numero', unidad: 'kg' },
    { clave: 'temperaturaC', etiqueta: 'Temperatura', tipo: 'numero', unidad: '°C' },
  ],
  [VerticalKey.PELUQUERIA]: [
    { clave: 'serviciosRealizados', etiqueta: 'Servicios realizados', tipo: 'texto', placeholder: 'Ej. baño, corte a tijera, uñas' },
    { clave: 'productos', etiqueta: 'Productos utilizados', tipo: 'texto' },
    { clave: 'estadoPielManto', etiqueta: 'Estado de piel y manto', tipo: 'textoLargo' },
    { clave: 'comportamiento', etiqueta: 'Comportamiento durante el servicio', tipo: 'texto' },
    { clave: 'recomendaciones', etiqueta: 'Recomendaciones', tipo: 'textoLargo' },
  ],
  [VerticalKey.ADIESTRAMIENTO]: [
    { clave: 'objetivos', etiqueta: 'Objetivos', tipo: 'textoLargo' },
    { clave: 'ejercicios', etiqueta: 'Ejercicios trabajados', tipo: 'textoLargo' },
    { clave: 'evolucion', etiqueta: 'Evolución', tipo: 'textoLargo' },
    { clave: 'tareasCasa', etiqueta: 'Tareas para casa', tipo: 'textoLargo' },
  ],
};

export function tieneHistorialDeServicio(vertical: string): boolean {
  return (VERTICALES_CON_HISTORIAL as readonly string[]).includes(vertical);
}

export function camposDeRegistro(vertical: string): readonly CampoRegistro[] {
  return CAMPOS_REGISTRO_SERVICIO[vertical as VerticalKey] ?? [];
}

/**
 * Deja sólo los campos conocidos de la categoría, con texto recortado y
 * números válidos. Lo que llega vacío no se guarda: un "Diagnóstico:" en
 * blanco en el informe parece un dato olvidado.
 */
export function limpiarDatosRegistro(
  vertical: string,
  datos: Record<string, unknown> | undefined,
): Record<string, string | number> {
  const limpio: Record<string, string | number> = {};
  if (!datos) return limpio;

  for (const campo of camposDeRegistro(vertical)) {
    const valor = datos[campo.clave];
    if (campo.tipo === 'numero') {
      const numero = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor;
      if (typeof numero === 'number' && Number.isFinite(numero) && valor !== '') limpio[campo.clave] = numero;
      continue;
    }
    if (typeof valor === 'string' && valor.trim()) limpio[campo.clave] = valor.trim();
  }
  return limpio;
}
