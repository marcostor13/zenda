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
}

export class ReporteVerticalDto {
  vertical!: string;
  gmv!: number;
  comision!: number;
  costoStripe!: number;
  margenNeto!: number;
  totalReservas!: number;
}
