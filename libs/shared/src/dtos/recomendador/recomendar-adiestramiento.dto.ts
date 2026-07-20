import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const MOTIVOS_ADIESTRAMIENTO = [
  'tirones_correa', 'no_acude_llamada', 'ansiedad_separacion', 'destruccion_casa',
  'ladridos_excesivos', 'miedos', 'agresividad_perros', 'agresividad_personas',
  'problemas_ninos', 'proteccion_recursos', 'obediencia_basica', 'socializacion',
  'preparacion_cachorro', 'otro',
] as const;
export type MotivoAdiestramiento = (typeof MOTIVOS_ADIESTRAMIENTO)[number];

export const INTENSIDADES = ['leve', 'moderado', 'grave'] as const;
export type Intensidad = (typeof INTENSIDADES)[number];

export class RecomendarAdiestramientoDto {
  @IsIn(MOTIVOS_ADIESTRAMIENTO)
  motivo!: MotivoAdiestramiento;

  @IsIn(INTENSIDADES)
  intensidad!: Intensidad;

  @IsOptional()
  @IsInt()
  @Min(0)
  edadMeses?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

export type TipoRecomendacionAdiestramiento = 'curso_cachorros' | 'valoracion_previa' | 'individual_o_grupal';

export interface RecomendacionAdiestramientoDto {
  tipoRecomendado: TipoRecomendacionAdiestramiento;
  bloqueaGrupales: boolean;
  mensaje: string;
}
