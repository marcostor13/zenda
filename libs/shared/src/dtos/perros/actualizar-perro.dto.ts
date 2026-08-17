import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SexoPerro, TamanoPerro, TipoPelo, NivelSociabilidad } from '../../enums/perro.enum';
import { VacunaAplicadaDto } from './crear-perro.dto';

/** Mismos campos que CrearPerroDto, todos opcionales (actualización parcial). */
export class ActualizarPerroDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nombre?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotos?: string[];

  @IsOptional()
  @IsString()
  especie?: string;

  @IsOptional()
  @IsString()
  raza?: string;

  @IsOptional()
  @IsBoolean()
  esMestizo?: boolean;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsEnum(SexoPerro)
  sexo?: SexoPerro;

  @IsOptional()
  @IsBoolean()
  esterilizado?: boolean;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  peso?: number;

  @IsOptional()
  @IsString()
  microchip?: string;

  @IsOptional()
  @IsDateString()
  fechaImplantacionMicrochip?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(TipoPelo, { each: true })
  tipoPelo?: TipoPelo[];

  @IsOptional()
  @IsEnum(TamanoPerro)
  tamano?: TamanoPerro;

  @IsOptional()
  @IsString()
  estadoManto?: string;

  @IsOptional()
  @IsBoolean()
  esPPP?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vacunas?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacunaAplicadaDto)
  vacunasDetalle?: VacunaAplicadaDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alergias?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enfermedades?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medicacion?: string[];

  @IsOptional()
  @IsString()
  dieta?: string;

  @IsOptional()
  @IsEnum(NivelSociabilidad)
  sociabilidadPerros?: NivelSociabilidad;

  @IsOptional()
  @IsEnum(NivelSociabilidad)
  sociabilidadPersonas?: NivelSociabilidad;

  @IsOptional()
  @IsBoolean()
  puedeQuedarseSolo?: boolean;

  @IsOptional()
  @IsBoolean()
  ansiedadSeparacion?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  miedos?: string[];

  @IsOptional()
  @IsString()
  temperamento?: string;

  @IsOptional()
  @IsBoolean()
  reactividadCorrea?: boolean;

  @IsOptional()
  @IsBoolean()
  protectorRecursos?: boolean;

  // --- Conducta específica de alojamiento (HU-004) ---
  @IsOptional()
  @IsBoolean()
  orinaEnInterior?: boolean;

  @IsOptional()
  @IsBoolean()
  ladraAlQuedarseSolo?: boolean;

  @IsOptional()
  @IsBoolean()
  destructivoEnSoledad?: boolean;

  /** Conducta de riesgo para residencias (Ref. RES5): el perro tiende a escaparse. */
  @IsOptional()
  @IsBoolean()
  tendenciaEscapar?: boolean;

  @IsOptional()
  @IsString()
  notasAlojamiento?: string;

  @IsOptional()
  @IsBoolean()
  toleraTrayectosLargos?: boolean;

  @IsOptional()
  @IsBoolean()
  seMarea?: boolean;

  @IsOptional()
  @IsBoolean()
  requiereTransportin?: boolean;

  @IsOptional()
  @IsString()
  cartillaSanitariaUrl?: string;

  @IsOptional()
  @IsString()
  pasaporteEuropeoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificadosUrl?: string[];

  @IsOptional()
  @IsBoolean()
  autorizaCompartirHistorial?: boolean;
}
