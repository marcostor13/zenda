/** País con prefijo telefónico, para el selector de teléfono. */
export interface PaisTelefono {
  /** ISO 3166-1 alfa-2; identifica el país aunque comparta prefijo con otro. */
  readonly iso: string;
  readonly nombre: string;
  /** Prefijo internacional con el `+` incluido. */
  readonly prefijo: string;
  readonly bandera: string;
}

/** España por defecto: es el mercado de partida de la plataforma. */
export const PAIS_POR_DEFECTO = 'ES';

/**
 * Países europeos con su prefijo telefónico.
 *
 * Ordenados alfabéticamente salvo España, que va primero por ser el mercado
 * principal: es el que elige la inmensa mayoría y ahorra buscarlo en la lista.
 *
 * Ojo con los prefijos compartidos: +7 lo usan Rusia y Kazajistán, y +47
 * Noruega y Svalbard. Por eso el país se identifica por `iso`, no por prefijo.
 */
export const PAISES_EUROPA: readonly PaisTelefono[] = [
  { iso: 'ES', nombre: 'España', prefijo: '+34', bandera: '🇪🇸' },

  { iso: 'AL', nombre: 'Albania', prefijo: '+355', bandera: '🇦🇱' },
  { iso: 'DE', nombre: 'Alemania', prefijo: '+49', bandera: '🇩🇪' },
  { iso: 'AD', nombre: 'Andorra', prefijo: '+376', bandera: '🇦🇩' },
  { iso: 'AT', nombre: 'Austria', prefijo: '+43', bandera: '🇦🇹' },
  { iso: 'BE', nombre: 'Bélgica', prefijo: '+32', bandera: '🇧🇪' },
  { iso: 'BY', nombre: 'Bielorrusia', prefijo: '+375', bandera: '🇧🇾' },
  { iso: 'BA', nombre: 'Bosnia y Herzegovina', prefijo: '+387', bandera: '🇧🇦' },
  { iso: 'BG', nombre: 'Bulgaria', prefijo: '+359', bandera: '🇧🇬' },
  { iso: 'CY', nombre: 'Chipre', prefijo: '+357', bandera: '🇨🇾' },
  { iso: 'VA', nombre: 'Ciudad del Vaticano', prefijo: '+379', bandera: '🇻🇦' },
  { iso: 'HR', nombre: 'Croacia', prefijo: '+385', bandera: '🇭🇷' },
  { iso: 'DK', nombre: 'Dinamarca', prefijo: '+45', bandera: '🇩🇰' },
  { iso: 'SK', nombre: 'Eslovaquia', prefijo: '+421', bandera: '🇸🇰' },
  { iso: 'SI', nombre: 'Eslovenia', prefijo: '+386', bandera: '🇸🇮' },
  { iso: 'EE', nombre: 'Estonia', prefijo: '+372', bandera: '🇪🇪' },
  { iso: 'FI', nombre: 'Finlandia', prefijo: '+358', bandera: '🇫🇮' },
  { iso: 'FR', nombre: 'Francia', prefijo: '+33', bandera: '🇫🇷' },
  { iso: 'GR', nombre: 'Grecia', prefijo: '+30', bandera: '🇬🇷' },
  { iso: 'HU', nombre: 'Hungría', prefijo: '+36', bandera: '🇭🇺' },
  { iso: 'IE', nombre: 'Irlanda', prefijo: '+353', bandera: '🇮🇪' },
  { iso: 'IS', nombre: 'Islandia', prefijo: '+354', bandera: '🇮🇸' },
  { iso: 'IT', nombre: 'Italia', prefijo: '+39', bandera: '🇮🇹' },
  { iso: 'LV', nombre: 'Letonia', prefijo: '+371', bandera: '🇱🇻' },
  { iso: 'LI', nombre: 'Liechtenstein', prefijo: '+423', bandera: '🇱🇮' },
  { iso: 'LT', nombre: 'Lituania', prefijo: '+370', bandera: '🇱🇹' },
  { iso: 'LU', nombre: 'Luxemburgo', prefijo: '+352', bandera: '🇱🇺' },
  { iso: 'MT', nombre: 'Malta', prefijo: '+356', bandera: '🇲🇹' },
  { iso: 'MD', nombre: 'Moldavia', prefijo: '+373', bandera: '🇲🇩' },
  { iso: 'MC', nombre: 'Mónaco', prefijo: '+377', bandera: '🇲🇨' },
  { iso: 'ME', nombre: 'Montenegro', prefijo: '+382', bandera: '🇲🇪' },
  { iso: 'NO', nombre: 'Noruega', prefijo: '+47', bandera: '🇳🇴' },
  { iso: 'NL', nombre: 'Países Bajos', prefijo: '+31', bandera: '🇳🇱' },
  { iso: 'PL', nombre: 'Polonia', prefijo: '+48', bandera: '🇵🇱' },
  { iso: 'PT', nombre: 'Portugal', prefijo: '+351', bandera: '🇵🇹' },
  { iso: 'GB', nombre: 'Reino Unido', prefijo: '+44', bandera: '🇬🇧' },
  { iso: 'CZ', nombre: 'República Checa', prefijo: '+420', bandera: '🇨🇿' },
  { iso: 'MK', nombre: 'República de Macedonia del Norte', prefijo: '+389', bandera: '🇲🇰' },
  { iso: 'RO', nombre: 'Rumanía', prefijo: '+40', bandera: '🇷🇴' },
  { iso: 'RU', nombre: 'Rusia', prefijo: '+7', bandera: '🇷🇺' },
  { iso: 'SM', nombre: 'San Marino', prefijo: '+378', bandera: '🇸🇲' },
  { iso: 'RS', nombre: 'Serbia', prefijo: '+381', bandera: '🇷🇸' },
  { iso: 'SE', nombre: 'Suecia', prefijo: '+46', bandera: '🇸🇪' },
  { iso: 'CH', nombre: 'Suiza', prefijo: '+41', bandera: '🇨🇭' },
  { iso: 'UA', nombre: 'Ucrania', prefijo: '+380', bandera: '🇺🇦' },
];

/**
 * Busca el país de un teléfono en formato internacional.
 *
 * Compara del prefijo más largo al más corto: si no, `+3` de un hipotético país
 * se quedaría con los números de `+34`.
 */
export function paisDelTelefono(telefono: string): PaisTelefono | undefined {
  if (!telefono.startsWith('+')) return undefined;

  return [...PAISES_EUROPA]
    .sort((a, b) => b.prefijo.length - a.prefijo.length)
    .find((p) => telefono.startsWith(p.prefijo));
}
