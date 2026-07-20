import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export const MOTIVOS_VETERINARIA = [
  'vacunacion', 'revision_general', 'problemas_digestivos', 'problemas_dermatologicos',
  'cojera', 'ojos', 'oidos', 'tos', 'vomitos', 'diarrea', 'problemas_urinarios',
  'control_medicacion', 'otro',
] as const;
export type MotivoVeterinaria = (typeof MOTIVOS_VETERINARIA)[number];

export const GRAVEDADES = ['leve', 'moderada', 'grave', 'emergencia'] as const;
export type Gravedad = (typeof GRAVEDADES)[number];

export const SINTOMAS_URGENTES = [
  'sangrado', 'dificultad_respiratoria', 'convulsiones',
] as const;

export class RecomendarVeterinariaDto {
  @IsIn(MOTIVOS_VETERINARIA)
  motivo!: MotivoVeterinaria;

  @IsIn(GRAVEDADES)
  gravedad!: Gravedad;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sintomasAsociados?: string[];
}

export type AccionRecomendadaVeterinaria = 'reserva_directa' | 'consulta_general' | 'urgencias_inmediatas';

export interface RecomendacionVeterinariaDto {
  accion: AccionRecomendadaVeterinaria;
  mensaje: string;
}
