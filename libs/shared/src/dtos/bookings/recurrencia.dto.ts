import { IsArray, IsInt, IsString, IsDateString, Min, Max } from 'class-validator';

/**
 * Patrón simple de recurrencia (docs/mejora_servicios.md §4.3: "todos los lunes y
 * miércoles a las 09:00" para guardería/peluquería mensual/rehabilitación). Genera
 * una serie de reservas hijas independientes, no un scheduler nuevo (decisión de
 * modelado ya tomada, ver docs/PLAN-IMPLEMENTACION-MEJORA-SERVICIOS.md).
 */
export class RecurrenciaDto {
  /** Días de la semana en que se repite (0 = domingo … 6 = sábado, convención JS Date#getDay). */
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasSemana!: number[];

  /** Hora local de cada ocurrencia, formato "HH:mm". */
  @IsString()
  hora!: string;

  /** Última fecha (inclusive) en que se genera una ocurrencia. */
  @IsDateString()
  fechaFin!: string;
}
