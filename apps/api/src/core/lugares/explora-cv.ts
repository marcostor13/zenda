import { EstadoModeracion, TipoLugar, ZonaAdmitidaLugar, resolverMunicipio } from 'shared';

/**
 * Conversión de `docs/datos/explora-cv-2026-09-24.json` a fichas de `lugares`.
 *
 * El fichero sale de los dos PDF del cliente del 24-09-2026: restaurantes y
 * cafeterías pet friendly (primera fase documental) y tiendas de animales de
 * las cadenas comprobadas en sus localizadores oficiales. Vive aquí y no en el
 * script para poder probarla; el script sólo lee, geocodifica y guarda.
 */

/** Una fila del fichero de datos, tal cual. */
export interface FilaExplora {
  tipo: 'restaurante' | 'tienda';
  nombre: string;
  municipio: string;
  provincia: string;
  direccion: string;
  fuente: string;
  estado: 'pendiente' | 'publicado';
  zonaAdmitida?: string;
  condiciones?: string;
  cadena?: string;
}

/** Ficha lista para insertar en la colección `lugares`. */
export interface LugarExplora {
  tipo: TipoLugar;
  nombre: string;
  descripcion: string;
  fotos: string[];
  ubicacion: { ciudad: string; provincia: string; direccion: string };
  atributos: Record<string, unknown>;
  origenDatos: string;
  estado: EstadoModeracion;
}

export const ORIGEN_EXPLORA_CV = 'PDF cliente 24-09-2026';

const ZONAS = new Set<string>(Object.values(ZonaAdmitidaLugar));

/**
 * Nombre de la población tal como lo escriben las fichas del catálogo.
 *
 * Los PDF usan el nombre oficial en valenciano («Alacant», «Castelló de la
 * Plana», «València»); el resto de la plataforma, el castellano. Si no se
 * unificaran, filtrar «Alicante» en Explora dejaría fuera siete restaurantes.
 * Sólo se cambia con una coincidencia exacta o por alias: la aproximada podría
 * convertir un pueblo pequeño en otro parecido.
 */
export function poblacionCanonica(municipio: string): string {
  const resuelto = resolverMunicipio(municipio);
  if (!resuelto || resuelto.origen === 'aproximada') return municipio.trim();
  return resuelto.municipio.nombre;
}

function zonaDe(fila: FilaExplora): ZonaAdmitidaLugar {
  return fila.zonaAdmitida && ZONAS.has(fila.zonaAdmitida)
    ? (fila.zonaAdmitida as ZonaAdmitidaLugar)
    : ZonaAdmitidaLugar.POR_CONFIRMAR;
}

function restauranteDe(fila: FilaExplora, ciudad: string): Pick<LugarExplora, 'tipo' | 'descripcion' | 'atributos'> {
  const zona = zonaDe(fila);
  const descripcion = zona === ZonaAdmitidaLugar.POR_CONFIRMAR
    ? `Restaurante o cafetería de ${ciudad} que admite perros según ${fila.fuente}. `
      + 'Confirma con el local si puedes entrar con tu perro o sólo en la terraza antes de ir.'
    : `Restaurante o cafetería de ${ciudad} que admite perros.`;
  return {
    tipo: TipoLugar.RESTAURANTE,
    descripcion,
    atributos: {
      zonaAdmitida: zona,
      ...(fila.condiciones ? { condiciones: fila.condiciones } : {}),
      fuente: fila.fuente,
    },
  };
}

function tiendaDe(fila: FilaExplora, ciudad: string): Pick<LugarExplora, 'tipo' | 'descripcion' | 'atributos'> {
  const cadena = fila.cadena ?? fila.nombre;
  return {
    tipo: TipoLugar.TIENDA,
    descripcion: `Tienda de animales ${cadena} en ${ciudad}: pienso, snacks y accesorios para tu perro.`,
    atributos: { cadena, fuente: fila.fuente },
  };
}

/**
 * Ficha de una fila. El nombre lleva la población en las cadenas —hay 39
 * «Miscota»— para que la tarjeta y el slug distingan una tienda de otra.
 */
export function lugarDeFila(fila: FilaExplora): LugarExplora | null {
  const nombre = fila.nombre?.trim();
  const municipio = fila.municipio?.trim();
  if (!nombre || !municipio) return null;

  const ciudad = poblacionCanonica(municipio);
  const propio = fila.tipo === 'tienda' ? tiendaDe(fila, ciudad) : restauranteDe(fila, ciudad);

  return {
    ...propio,
    nombre: fila.tipo === 'tienda' ? `${nombre} ${ciudad}` : nombre,
    fotos: [],
    ubicacion: { ciudad, provincia: fila.provincia.trim(), direccion: fila.direccion.trim() },
    origenDatos: ORIGEN_EXPLORA_CV,
    estado: fila.estado === 'publicado' ? EstadoModeracion.PUBLICADO : EstadoModeracion.PENDIENTE,
  };
}

/**
 * Calle y número de la dirección, sin código postal ni población:
 * «C/ Cuba 12, 46006 València» → «C/ Cuba 12»; «C. Bolulla, 23, 03009» →
 * «C. Bolulla, 23» (el número a veces va tras la coma).
 */
export function calleDe(direccion: string): string {
  const [calle, siguiente] = direccion.split(',').map((tramo) => tramo.trim());
  return siguiente && /^\d+[a-z]?$/i.test(siguiente) ? `${calle}, ${siguiente}` : calle;
}

/**
 * Todas las fichas del fichero. Cuando una cadena tiene varias tiendas en la
 * misma población —17 Miscota en Valencia—, el nombre lleva además la calle:
 * diecisiete tarjetas iguales en `/explora` no dejarían elegir ninguna.
 */
export function lugaresDeFilas(filas: readonly FilaExplora[]): LugarExplora[] {
  const lugares = filas.map(lugarDeFila).filter((lugar): lugar is LugarExplora => lugar !== null);
  const repeticiones = new Map<string, number>();
  for (const lugar of lugares) {
    repeticiones.set(lugar.nombre, (repeticiones.get(lugar.nombre) ?? 0) + 1);
  }
  return lugares.map((lugar) =>
    (repeticiones.get(lugar.nombre) ?? 0) > 1
      ? { ...lugar, nombre: `${lugar.nombre} · ${calleDe(lugar.ubicacion.direccion)}` }
      : lugar,
  );
}
