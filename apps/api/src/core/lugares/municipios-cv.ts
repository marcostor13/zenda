import { EstadoModeracion, TipoLugar } from 'shared';

/**
 * Conversión de la hoja `docs/municipios_final.xlsx` a fichas de `lugares`.
 *
 * La hoja es un censo de los 542 municipios de la Comunitat Valenciana con tres
 * columnas de recursos caninos: playa canina, río y pipicán. Cada recurso es una
 * ficha distinta en `/explora`, no un atributo del municipio: la persona busca
 * "playas donde llevar al perro", no "municipios que tienen playa".
 *
 * Vive aquí y no dentro del script de siembra para poder probar la conversión:
 * el script sólo lee el fichero y guarda lo que salga de aquí.
 */

/** Una fila del Excel, tal cual la devuelve la hoja. */
export interface FilaMunicipio {
  provincia?: string | null;
  comarca?: string | null;
  municipio?: string | null;
  playaCanina?: string | null;
  rio?: string | null;
  pipican?: string | null;
}

/** Ficha lista para insertar en la colección `lugares`. */
export interface LugarSembrado {
  tipo: TipoLugar;
  nombre: string;
  descripcion: string;
  fotos: string[];
  ubicacion: { ciudad: string; provincia?: string };
  atributos: Record<string, unknown>;
  estado: EstadoModeracion;
}

/**
 * Un nombre más largo que esto no cabe en la tarjeta de `/explora` y se corta a
 * mitad de palabra; el texto completo se conserva en la descripción.
 */
const MAX_NOMBRE = 60;

/**
 * El INE nombra los municipios con el artículo detrás ("Campello, el") para que
 * ordenen alfabéticamente por el sustantivo. En pantalla eso se lee mal: la
 * persona busca "El Campello", no "Campello, el".
 */
export function normalizarMunicipio(nombre: string): string {
  const partes = nombre.split(',').map((p) => p.trim());
  if (partes.length !== 2) return nombre.trim();

  const [sustantivo, articulo] = partes;
  return `${articulo.charAt(0).toUpperCase()}${articulo.slice(1)} ${sustantivo}`;
}

/** Texto entre paréntesis de una celda tipo `Sí (Cala Rocío)`, si lo hay. */
export function detalleEntreParentesis(celda: string): string | null {
  const encontrado = /\(([^)]+)\)/.exec(celda);
  return encontrado ? encontrado[1].trim() : null;
}

/**
 * ¿El paréntesis es el nombre del sitio o una aclaración sobre él?
 *
 * La hoja mezcla las dos cosas: "(Cala Rocío)" nombra la playa, pero
 * "(junto a la playa canina)" sólo dice dónde está. Como nombre de ficha, la
 * segunda queda ridícula. La pista fiable es la mayúscula inicial —los nombres
 * propios la llevan— más que quepa en el título.
 */
export function pareceNombrePropio(detalle: string): boolean {
  const primera = detalle.charAt(0);
  return detalle.length <= MAX_NOMBRE && primera === primera.toUpperCase() && primera !== primera.toLowerCase();
}

/** Primera letra en mayúscula, para que la aclaración lea como una frase. */
const capitalizar = (texto: string): string =>
  `${texto.charAt(0).toUpperCase()}${texto.slice(1)}${texto.endsWith('.') ? '' : '.'}`;

/** true si la celda declara el recurso; vacía o ausente significa que no lo hay. */
const declarado = (celda?: string | null): celda is string => Boolean(celda?.trim());

function base(fila: FilaMunicipio, municipio: string): Pick<LugarSembrado, 'fotos' | 'ubicacion' | 'atributos' | 'estado'> {
  return {
    fotos: [],
    ubicacion: {
      ciudad: municipio,
      provincia: fila.provincia?.trim() || undefined,
    },
    atributos: {
      comarca: fila.comarca?.trim() || undefined,
      // Deja constancia de que el dato es del censo, no de una aportación de la
      // comunidad: si mañana hay que revisarlo, se sabe de dónde salió.
      fuente: 'municipios_final.xlsx',
    },
    /*
     * Publicado directamente. La moderación existe para lo que aporta la
     * comunidad (HU-045); esto es un censo revisado que se carga desde el
     * servidor, y dejarlo pendiente obligaría a un administrador a aprobar 117
     * fichas a mano sin aportar ninguna garantía extra.
     */
    estado: EstadoModeracion.PUBLICADO,
  };
}

/** Playa: la celda trae `Sí`, `Parcial` y a veces el nombre de la cala. */
function playaDe(fila: FilaMunicipio, municipio: string): LugarSembrado | null {
  if (!declarado(fila.playaCanina)) return null;

  const celda = fila.playaCanina.trim();
  const detalle = detalleEntreParentesis(celda);
  const parcial = celda.toLowerCase().startsWith('parcial');

  const esNombre = Boolean(detalle && pareceNombrePropio(detalle));
  const nombre = esNombre ? (detalle as string) : `Playa canina de ${municipio}`;

  const descripcion = [
    `Playa con acceso permitido a perros en ${municipio}.`,
    // "Parcial" en la hoja significa que no está abierta todo el año: decirlo
    // evita que alguien conduzca hasta allí en agosto y se lo encuentre cerrado.
    parcial ? 'Acceso parcial: consulta el calendario y los horarios del municipio antes de ir.' : null,
    detalle && !esNombre ? capitalizar(detalle) : null,
  ].filter(Boolean).join(' ');

  return {
    tipo: TipoLugar.PLAYA,
    nombre,
    descripcion,
    ...base(fila, municipio),
    atributos: { ...base(fila, municipio).atributos, accesoParcial: parcial },
  };
}

/** Río: la celda es directamente el nombre del río (`Turia`, `Júcar`…). */
function rioDe(fila: FilaMunicipio, municipio: string): LugarSembrado | null {
  if (!declarado(fila.rio)) return null;

  const rio = fila.rio.trim();

  return {
    tipo: TipoLugar.RIO,
    nombre: `Río ${rio} a su paso por ${municipio}`,
    descripcion: `Tramo del río ${rio} en ${municipio}, para pasear y refrescar al perro. Comprueba el estado del cauce y la normativa local antes de bañarlo.`,
    ...base(fila, municipio),
    atributos: { ...base(fila, municipio).atributos, rio },
  };
}

/** Pipicán: zona vallada de esparcimiento canino; en `lugares` es un parque. */
function pipicanDe(fila: FilaMunicipio, municipio: string): LugarSembrado | null {
  if (!declarado(fila.pipican)) return null;

  const detalle = detalleEntreParentesis(fila.pipican.trim());
  const esNombre = Boolean(detalle && pareceNombrePropio(detalle));
  const nombre = esNombre ? (detalle as string) : `Zona canina de ${municipio}`;

  const descripcion = [
    `Zona de esparcimiento canino en ${municipio}.`,
    detalle && !esNombre ? capitalizar(detalle) : null,
  ].filter(Boolean).join(' ');

  return {
    tipo: TipoLugar.PARQUE,
    nombre,
    descripcion,
    ...base(fila, municipio),
    atributos: { ...base(fila, municipio).atributos, vallado: true },
  };
}

/**
 * Fichas que genera una fila del censo: entre 0 y 3, una por recurso declarado.
 * Un municipio sin ninguno no produce nada — el censo los lista todos, pero
 * `/explora` sólo debe enseñar sitios a los que ir.
 */
export function lugaresDeMunicipio(fila: FilaMunicipio): LugarSembrado[] {
  const municipio = normalizarMunicipio(fila.municipio?.trim() ?? '');
  if (!municipio) return [];

  return [playaDe(fila, municipio), rioDe(fila, municipio), pipicanDe(fila, municipio)]
    .filter((l): l is LugarSembrado => l !== null);
}
