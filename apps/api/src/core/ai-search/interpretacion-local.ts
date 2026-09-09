import { VerticalKey } from 'shared';

/**
 * Lo que el intérprete local sabe sacar de una frase. Es un subconjunto de
 * `SearchParams`: aquí sólo se rellena lo que se puede afirmar sin modelo.
 */
export interface InterpretacionLocal {
  vertical: VerticalKey | null;
  ciudad: string | null;
  desde: string | null;
  hasta: string | null;
  presupuestoMax: number | null;
  pasajeros: number | null;
  extras: Record<string, string>;
}

/**
 * Sinónimos por categoría, en español e inglés.
 *
 * Se comparan sin tildes y en minúsculas contra la frase entera, así que basta
 * con la raíz: «peluquer» cubre peluquería, peluquerías y peluquero.
 *
 * **El orden importa: gana la primera categoría que casa.** Por eso las
 * ambiguas van al final. «Hotel» es el caso claro: un *hotel para perros* es
 * alojamiento canino —el perro se queda— y un *hotel pet-friendly* lo reserva
 * la persona que viaja con él. Se resuelve poniendo las expresiones completas
 * de cada uno en su categoría y dejando alojamiento el último, para que
 * «hotel pet friendly» no se lo lleve por delante.
 */
const SINONIMOS: ReadonlyArray<readonly [VerticalKey, readonly string[]]> = [
  [VerticalKey.PELUQUERIA, [
    'peluquer', 'grooming', 'groomer', 'esteticacanina', 'estetica canina',
    'bano y corte', 'bano de perro', 'deslanado', 'corte de pelo', 'aseo canino',
    'dog grooming', 'pet grooming', 'wash and cut',
  ]],
  [VerticalKey.VETERINARIA, [
    'veterinar', 'clinica', 'vacuna', 'vacunacion', 'desparasit', 'microchip',
    'castracion', 'esterilizacion', 'analitica', 'urgencia', 'consulta',
    'vet', 'vaccine', 'clinic', 'neutering', 'spaying', 'checkup',
  ]],
  [VerticalKey.ADIESTRAMIENTO, [
    'adiestr', 'educacion canina', 'educador canino', 'obediencia', 'etolog',
    'modificacion de conducta', 'training', 'dog trainer', 'obedience',
  ]],
  [VerticalKey.TRANSPORTE, [
    'transport', 'traslado', 'llevar a mi perro', 'taxi', 'recogida y entrega',
    'mudanza', 'transfer', 'pet taxi', 'transport',
  ]],
  [VerticalKey.FUNERARIOS, [
    'funerar', 'cremacion', 'crematorio', 'incinerac', 'entierro', 'despedida',
    'eutanasia', 'cenizas', 'cremation', 'pet funeral',
  ]],
  [VerticalKey.SEGUROS, [
    'seguro', 'poliza', 'aseguradora', 'cobertura', 'responsabilidad civil',
    'insurance', 'policy', 'liability',
  ]],
  [VerticalKey.HOTELES, [
    'hotel petfriendly', 'hotel pet friendly', 'hotel pet-friendly',
    'hotel que admita', 'hotel que admite', 'hotel con perro', 'viajar con mi perro',
    'apartamento', 'alojamiento petfriendly', 'alojamiento pet friendly',
    'pet friendly hotel', 'pet-friendly hotel', 'dog friendly hotel',
  ]],
  [VerticalKey.ALOJAMIENTO, [
    'alojamiento', 'residencia canina', 'residencia para perro', 'residencia de perro',
    'guarderia', 'hospedaje', 'dejar a mi perro', 'cuidar a mi perro',
    'hotel canino', 'hotel para perro', 'hotel de perro', 'pension canina',
    'dog boarding', 'kennel', 'dog hotel', 'pet boarding', 'daycare',
  ]],
];

/**
 * Poblaciones reconocidas sin necesidad de la preposición.
 *
 * No pretende ser un censo: son las plazas con oferta y las capitales europeas
 * desde las que llegan las búsquedas. Cualquier otra se sigue detectando por el
 * patrón «en …», que es como se escribe una ciudad en una frase.
 */
const CIUDADES: readonly string[] = [
  // España — capitales de provincia y plazas con oferta.
  'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia',
  'Palma de Mallorca', 'Palma', 'Las Palmas de Gran Canaria', 'Las Palmas',
  'Bilbao', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Granada',
  'A Coruña', 'La Coruña', 'Vitoria', 'Elche', 'Oviedo', 'Badalona', 'Cartagena',
  'Terrassa', 'Jerez de la Frontera', 'Sabadell', 'Móstoles', 'Santa Cruz de Tenerife',
  'Pamplona', 'Almería', 'Alcalá de Henares', 'Fuenlabrada', 'Leganés', 'Donostia',
  'San Sebastián', 'Getafe', 'Burgos', 'Albacete', 'Santander', 'Castellón',
  'Castellón de la Plana', 'Alcorcón', 'Logroño', 'Badajoz', 'Salamanca', 'Huelva',
  'Marbella', 'Lleida', 'Tarragona', 'León', 'Cádiz', 'Jaén', 'Ourense', 'Lugo',
  'Girona', 'Cáceres', 'Toledo', 'Ceuta', 'Melilla', 'Guadalajara', 'Ávila',
  'Segovia', 'Soria', 'Cuenca', 'Zamora', 'Palencia', 'Huesca', 'Teruel',
  'Ciudad Real', 'Pontevedra', 'Ibiza', 'Benidorm', 'Torrevieja', 'Gandía',
  'Sitges', 'Estepona', 'Fuengirola', 'Torremolinos', 'Mijas', 'Sanxenxo',
  // Europa — destinos frecuentes de quien viaja con perro.
  'Lisboa', 'Oporto', 'París', 'Lyon', 'Marsella', 'Burdeos', 'Toulouse',
  'Roma', 'Milán', 'Florencia', 'Nápoles', 'Turín', 'Venecia',
  'Berlín', 'Múnich', 'Hamburgo', 'Fráncfort', 'Colonia',
  'Ámsterdam', 'Róterdam', 'Bruselas', 'Amberes', 'Viena', 'Zúrich', 'Ginebra',
  'Varsovia', 'Cracovia', 'Praga', 'Budapest', 'Dublín', 'Londres', 'Copenhague',
  'Estocolmo', 'Oslo', 'Helsinki', 'Atenas',
];

/** Palabras que van detrás de «en» y no son una ciudad. */
const NO_CIUDAD = new Set([
  'casa', 'domicilio', 'oferta', 'promocion', 'general', 'urgencia', 'urgencias',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'enero', 'febrero',
  'marzo', 'abril', 'mayo', 'junio', 'julio', 'verano', 'invierno', 'navidad',
  'semana', 'fin', 'mi', 'el', 'la', 'los', 'las', 'un', 'una', 'total',
]);

const MESES: Readonly<Record<string, number>> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

/** Minúsculas y sin tildes: así «Peluquería» y «peluqueria» son la misma palabra. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const iso = (fecha: Date): string => fecha.toISOString().slice(0, 10);
const sumarDias = (fecha: Date, dias: number): Date =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);

/**
 * Interpreta la frase sin ayuda de ningún modelo.
 *
 * Existe porque la búsqueda con IA es un servicio externo y opcional: sin
 * `DEEPSEEK_API_KEY`, o con la API caída, el asistente devolvía todo a `null` y
 * el buscador acababa en alojamiento sin ciudad —«Peluquería canina en
 * Valencia» terminaba en residencias caninas de cualquier sitio—. Con esto la
 * frase se entiende siempre; el modelo, cuando está, sólo añade matices.
 *
 * @param hoy fecha de referencia para lo relativo («este fin de semana»).
 */
export function interpretarLocalmente(consulta: string, hoy = new Date()): InterpretacionLocal {
  const texto = normalizar(consulta);

  return {
    vertical: detectarVertical(texto),
    ciudad: detectarCiudad(consulta, texto),
    ...detectarFechas(texto, hoy),
    presupuestoMax: detectarPresupuesto(texto),
    pasajeros: detectarPerros(texto),
    extras: detectarExtras(consulta, texto),
  };
}

function detectarVertical(texto: string): VerticalKey | null {
  for (const [vertical, terminos] of SINONIMOS) {
    if (terminos.some((termino) => texto.includes(termino))) return vertical;
  }
  return null;
}

/**
 * La ciudad se busca primero en el censo y sólo después por el patrón «en …».
 *
 * Al revés fallaría con «peluquería en Las Palmas de Gran Canaria»: el patrón
 * corta en la primera palabra en minúscula y se quedaría con «Las».
 */
function detectarCiudad(original: string, texto: string): string | null {
  const delCenso = CIUDADES
    .filter((ciudad) => texto.includes(normalizar(ciudad)))
    // La más larga gana: «Palma de Mallorca» antes que «Palma».
    .sort((a, b) => b.length - a.length)[0];
  if (delCenso) return delCenso;

  // «en Valencia», «in Valencia», «cerca de Valencia».
  const patron = /\b(?:en|in|cerca de|near|around|por)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]*(?:\s+(?:de|del|la|las|los|el|d')?\s*[A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]*)*)/;
  const encontrado = patron.exec(original);
  if (!encontrado) return null;

  const candidato = encontrado[1].trim();
  if (NO_CIUDAD.has(normalizar(candidato))) return null;
  return candidato;
}

/**
 * Fechas relativas. Sólo se reconoce lo que se escribe de verdad en un
 * buscador; el resto se deja vacío para que el usuario lo elija en el
 * calendario, que es más rápido que adivinar mal.
 */
function detectarFechas(texto: string, hoy: Date): { desde: string | null; hasta: string | null } {
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  if (/\bhoy\b|\btoday\b/.test(texto)) {
    return { desde: iso(hoySinHora), hasta: iso(hoySinHora) };
  }
  if (/\bmanana\b|\btomorrow\b/.test(texto)) {
    const manana = sumarDias(hoySinHora, 1);
    return { desde: iso(manana), hasta: iso(manana) };
  }
  if (/fin de semana|weekend/.test(texto)) {
    // Sábado más próximo (incluido hoy si ya es sábado) y su domingo.
    const alSabado = (6 - hoySinHora.getDay() + 7) % 7;
    const sabado = sumarDias(hoySinHora, alSabado);
    return { desde: iso(sabado), hasta: iso(sumarDias(sabado, 1)) };
  }
  if (/(la )?proxima semana|next week/.test(texto)) {
    const alLunes = ((8 - hoySinHora.getDay()) % 7) || 7;
    const lunes = sumarDias(hoySinHora, alLunes);
    return { desde: iso(lunes), hasta: iso(sumarDias(lunes, 6)) };
  }

  const mes = /\b(?:en|in|para|durante)\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/.exec(texto);
  if (mes) {
    const indice = MESES[mes[1]];
    // Un mes ya pasado se entiende como el del año que viene.
    const anio = indice < hoySinHora.getMonth() ? hoySinHora.getFullYear() + 1 : hoySinHora.getFullYear();
    return { desde: iso(new Date(anio, indice, 1)), hasta: iso(new Date(anio, indice + 1, 0)) };
  }

  return { desde: null, hasta: null };
}

/** «menos de 40 euros», «hasta 40€», «under 40 eur», «presupuesto 40». */
function detectarPresupuesto(texto: string): number | null {
  const patrones = [
    /(?:menos de|hasta|max(?:imo)?|por debajo de|under|below|budget|presupuesto(?: de)?)\s*(\d{1,5})\s*(?:e|eur|euros?|€)?/,
    /(\d{1,5})\s*(?:e|eur|euros?|€)\s*(?:como maximo|maximo|max|o menos)/,
  ];
  for (const patron of patrones) {
    const encontrado = patron.exec(texto);
    if (encontrado) {
      const valor = Number(encontrado[1]);
      if (Number.isFinite(valor) && valor > 0) return valor;
    }
  }
  return null;
}

/** «para 2 perros», «mis tres perros», «2 dogs». */
function detectarPerros(texto: string): number | null {
  const enLetra: Readonly<Record<string, number>> = {
    un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    one: 1, two: 2, three: 3, four: 4, five: 5,
  };

  const conCifra = /(\d{1,2})\s*(?:perros?|mascotas?|dogs?|pets?)\b/.exec(texto);
  if (conCifra) {
    const valor = Number(conCifra[1]);
    if (valor > 0 && valor <= 20) return valor;
  }

  const conLetra = /\b(un|una|uno|dos|tres|cuatro|cinco|one|two|three|four|five)\s+(?:perros?|mascotas?|dogs?|pets?)\b/.exec(texto);
  return conLetra ? enLetra[conLetra[1]] ?? null : null;
}

/** Origen y destino del transporte: es lo único que el listado sabe usar. */
function detectarExtras(original: string, texto: string): Record<string, string> {
  const extras: Record<string, string> = {};

  const trayecto = /\bde\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+)\s+a\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+)/.exec(original)
    ?? /\bdesde\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+)\s+(?:a|hasta|hacia)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+)/.exec(original)
    ?? /\bfrom\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+)\s+to\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ'-]+)/.exec(original);
  if (trayecto) {
    extras['origen'] = trayecto[1];
    extras['destino'] = trayecto[2];
  }

  if (/\ba domicilio\b|\ben casa\b|at home/.test(texto)) extras['aDomicilio'] = 'si';
  if (/urgencia|urgente|emergency|24 ?h/.test(texto)) extras['urgencias'] = 'si';

  return extras;
}
