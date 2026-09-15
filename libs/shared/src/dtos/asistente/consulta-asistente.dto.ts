import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** Quién habla en cada turno de la conversación. */
export type AutorMensaje = 'cliente' | 'asistente';

export class MensajeAsistenteDto {
  @IsIn(['cliente', 'asistente'])
  autor!: AutorMensaje;

  @IsString()
  @MaxLength(2000)
  texto!: string;
}

/**
 * Una pregunta al asistente, con lo poco que necesita para situarse.
 *
 * Viaja el historial reciente y no una conversación guardada en el servidor:
 * la consulta es anónima y de usar y tirar, así que no hay nada que almacenar
 * ni que borrar después. El tope de turnos acota además lo que se le manda al
 * modelo, que se paga por token.
 */
export class ConsultaAsistenteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  pregunta!: string;

  /** Turnos anteriores, del más antiguo al más reciente. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MensajeAsistenteDto)
  historial?: MensajeAsistenteDto[];

  /**
   * Ruta en la que está el usuario ("/alojamiento/123"). Deja que el asistente
   * responda a "¿cómo reservo esto?" sin preguntar de qué habla.
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  ruta?: string;
}

export interface RespuestaAsistenteApi {
  /**
   * false = no hay proveedor de IA configurado. El asistente lo dice y ofrece
   * el centro de ayuda, en vez de fingir una avería.
   */
  disponible: boolean;
  respuesta: string;
  /** Enlaces de la propia web que el asistente propone abrir. */
  enlaces?: Array<{ titulo: string; ruta: string }>;
}
