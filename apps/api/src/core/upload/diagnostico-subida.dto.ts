import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** En qué punto se quedó la subida. Ordenado por el recorrido del fichero. */
export const PASOS_SUBIDA = [
  /** El navegador entregó el fichero. Sólo se registra en modo verboso. */
  'elegido',
  /** Ni siquiera parecía una imagen: se descartó antes de tocar nada. */
  'descartado',
  /** `createImageBitmap` y el respaldo por etiqueta fallaron los dos. */
  'sin_decodificar',
  /** El canvas no devolvió nada, o lo devolvió sin convertir. */
  'sin_convertir',
  /** Convertida, pero sigue sin caber en el endpoint. */
  'demasiado_grande',
  /** Llegó vacía: la foto vive en iCloud y no está descargada. */
  'vacio',
  /** La petición al servidor falló. */
  'error_http',
  /** Terminó bien; sirve para saber qué proporción falla de verdad. */
  'subida',
] as const;

export type PasoSubida = (typeof PASOS_SUBIDA)[number];

/**
 * Lo que el navegador cuenta de una subida que no salió.
 *
 * **No viaja el contenido del fichero**, sólo lo que hace falta para reproducir
 * el caso: qué decía el navegador que era, cuánto pesaba y en qué paso se
 * rompió. El nombre sí va porque la extensión es a menudo el único indicio del
 * formato cuando iOS deja el tipo vacío.
 */
export class DiagnosticoSubidaDto {
  @IsIn(PASOS_SUBIDA)
  paso!: PasoSubida;

  /** Endpoint al que iba: `image`, `documento` o `video`. */
  @IsString()
  @MaxLength(20)
  destino!: string;

  /** Pantalla desde la que se subía; sitúa el fallo sin preguntar al usuario. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  origen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  nombre?: string;

  /** Lo que declaró el navegador; en iOS suele venir vacío. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tipo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bytes?: number;

  /** Tipo y peso después de convertir, cuando se llegó a convertir. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tipoFinal?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bytesFinales?: number;

  /** Código HTTP cuando el paso es `error_http`. */
  @IsOptional()
  @IsInt()
  estadoHttp?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  detalle?: string;

  /** Identifica el navegador y la versión de iOS, que es lo que más importa. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;
}
