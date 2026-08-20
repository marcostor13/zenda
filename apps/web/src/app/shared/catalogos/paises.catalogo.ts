/** País con prefijo telefónico, para el selector de teléfono. */
export interface PaisTelefono {
  /** ISO 3166-1 alfa-2; identifica el país aunque comparta prefijo con otro. */
  readonly iso: string;
  readonly nombre: string;
  /** Prefijo internacional con el `+` incluido. */
  readonly prefijo: string;
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
  { iso: 'ES', nombre: 'España', prefijo: '+34' },

  { iso: 'AL', nombre: 'Albania', prefijo: '+355' },
  { iso: 'DE', nombre: 'Alemania', prefijo: '+49' },
  { iso: 'AD', nombre: 'Andorra', prefijo: '+376' },
  { iso: 'AT', nombre: 'Austria', prefijo: '+43' },
  { iso: 'BE', nombre: 'Bélgica', prefijo: '+32' },
  { iso: 'BY', nombre: 'Bielorrusia', prefijo: '+375' },
  { iso: 'BA', nombre: 'Bosnia y Herzegovina', prefijo: '+387' },
  { iso: 'BG', nombre: 'Bulgaria', prefijo: '+359' },
  { iso: 'CY', nombre: 'Chipre', prefijo: '+357' },
  { iso: 'VA', nombre: 'Ciudad del Vaticano', prefijo: '+379' },
  { iso: 'HR', nombre: 'Croacia', prefijo: '+385' },
  { iso: 'DK', nombre: 'Dinamarca', prefijo: '+45' },
  { iso: 'SK', nombre: 'Eslovaquia', prefijo: '+421' },
  { iso: 'SI', nombre: 'Eslovenia', prefijo: '+386' },
  { iso: 'EE', nombre: 'Estonia', prefijo: '+372' },
  { iso: 'FI', nombre: 'Finlandia', prefijo: '+358' },
  { iso: 'FR', nombre: 'Francia', prefijo: '+33' },
  { iso: 'GR', nombre: 'Grecia', prefijo: '+30' },
  { iso: 'HU', nombre: 'Hungría', prefijo: '+36' },
  { iso: 'IE', nombre: 'Irlanda', prefijo: '+353' },
  { iso: 'IS', nombre: 'Islandia', prefijo: '+354' },
  { iso: 'IT', nombre: 'Italia', prefijo: '+39' },
  { iso: 'LV', nombre: 'Letonia', prefijo: '+371' },
  { iso: 'LI', nombre: 'Liechtenstein', prefijo: '+423' },
  { iso: 'LT', nombre: 'Lituania', prefijo: '+370' },
  { iso: 'LU', nombre: 'Luxemburgo', prefijo: '+352' },
  { iso: 'MT', nombre: 'Malta', prefijo: '+356' },
  { iso: 'MD', nombre: 'Moldavia', prefijo: '+373' },
  { iso: 'MC', nombre: 'Mónaco', prefijo: '+377' },
  { iso: 'ME', nombre: 'Montenegro', prefijo: '+382' },
  { iso: 'NO', nombre: 'Noruega', prefijo: '+47' },
  { iso: 'NL', nombre: 'Países Bajos', prefijo: '+31' },
  { iso: 'PL', nombre: 'Polonia', prefijo: '+48' },
  { iso: 'PT', nombre: 'Portugal', prefijo: '+351' },
  { iso: 'GB', nombre: 'Reino Unido', prefijo: '+44' },
  { iso: 'CZ', nombre: 'República Checa', prefijo: '+420' },
  { iso: 'MK', nombre: 'República de Macedonia del Norte', prefijo: '+389' },
  { iso: 'RO', nombre: 'Rumanía', prefijo: '+40' },
  { iso: 'RU', nombre: 'Rusia', prefijo: '+7' },
  { iso: 'SM', nombre: 'San Marino', prefijo: '+378' },
  { iso: 'RS', nombre: 'Serbia', prefijo: '+381' },
  { iso: 'SE', nombre: 'Suecia', prefijo: '+46' },
  { iso: 'CH', nombre: 'Suiza', prefijo: '+41' },
  { iso: 'UA', nombre: 'Ucrania', prefijo: '+380' },
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
