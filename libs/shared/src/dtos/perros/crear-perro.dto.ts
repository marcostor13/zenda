import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SexoPerro, TamanoPerro, TipoPelo, NivelSociabilidad, Vacuna } from '../../enums/perro.enum';
import { MICROCHIP_OPCIONAL_REGEX } from '../../mascotas/microchip';

/** Una vacuna marcada en la ficha, con su fecha si el dueño la recuerda. */
export class VacunaAplicadaDto {
  @IsEnum(Vacuna)
  tipo!: Vacuna;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}

export class CrearPerroDto {
  @IsString()
  @MinLength(1)
  nombre!: string;

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

  /** ISO 11784/11785: 15 dígitos. Cadena vacía = sin microchip. */
  @IsOptional()
  @IsString()
  @Matches(MICROCHIP_OPCIONAL_REGEX, { message: 'El microchip debe tener exactamente 15 dígitos' })
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

  /**
   * Opción positiva frente a la lista de problemas de conducta: el dueño puede
   * decir que su perro es muy bueno. El formulario la hace excluyente con los
   * problemas.
   */
  @IsOptional()
  @IsBoolean()
  esMuyBueno?: boolean;

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
