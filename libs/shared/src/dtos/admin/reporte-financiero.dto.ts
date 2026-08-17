export class ReporteFinancieroDto {
  fechaDesde!: string;
  fechaHasta!: string;
  gmv!: number;
  ingresosPlataforma!: number;
  costoStripe!: number;
  margenNetoPlataforma!: number;
  liquidacionesComercio!: number;
  totalReservas!: number;
  porVertical!: ReporteVerticalDto[];
  /** Ajustes de precio (suplementos) en el rango — Ref. S11. */
  totalReservasConAjuste!: number;
  importeTotalAjustes!: number;
  ajustesPorComercio!: ReporteAjustePorComercioDto[];
}

export class ReporteVerticalDto {
  vertical!: string;
  gmv!: number;
  comision!: number;
  costoStripe!: number;
  margenNeto!: number;
  totalReservas!: number;
}

/**
 * Frecuencia e impacto económico de los ajustes de precio por comercio (Ref. S11): permite
 * detectar negocios que ajustan precios con una frecuencia fuera de lo normal.
 */
export class ReporteAjustePorComercioDto {
  comercioId!: string;
  comercioNombre!: string;
  totalReservas!: number;
  reservasConAjuste!: number;
  importeAjustes!: number;
  porcentajeConAjuste!: number;
}
