import {
  AlojamientoViaje, DesplazamientoViaje, MAX_DIAS_ITINERARIO, PARADAS_POR_RITMO, RitmoViaje, VerticalKey,
} from 'shared';

/**
 * Cómo se arma un itinerario con los datos propios de Doogking.
 *
 * Son funciones puras —sin base de datos ni modelo de IA— para poder probar las
 * reglas que pidió el cliente el 28-09: más preguntas que cambien el plan y que
 * el plan **termine siempre en algo reservable** de la plataforma.
 */

/** Una parada del itinerario; si es reservable, trae su `servicioId`. */
export interface ParadaItinerario {
  titulo: string;
  descripcion: string;
  tipo: 'lugar' | 'servicio';
  /** Presente solo en paradas reservables: alimenta «Reservar» y «Añadir al viaje». */
  servicioId?: string;
  lugarId?: string;
  vertical?: string;
  precioEstimado?: number;
}

export interface DiaItinerario {
  dia: number;
  titulo: string;
  paradas: ParadaItinerario[];
}

export interface OpcionItinerario {
  nombre: string;
  resumen: string;
  presupuestoEstimado: number;
  dias: DiaItinerario[];
}

export interface LugarContexto {
  _id: unknown;
  nombre: string;
  tipo: string;
  descripcion?: string;
  ubicacion: { ciudad: string };
}

export interface ServicioContexto {
  _id: unknown;
  titulo: string;
  descripcion?: string;
  vertical: string;
  precioBase: number;
}

/** Las respuestas del formulario que dan forma al plan. */
export interface PreferenciasViaje {
  ritmo: RitmoViaje;
  alojamiento: AlojamientoViaje;
  desplazamiento: DesplazamientoViaje;
  serviciosExtra: readonly string[];
  /** Días pedidos por fechas; sin fechas, los decide el contenido disponible. */
  dias: number | null;
}

/** Cómo se titula un día según el tipo de sitio que lo domina. */
const TEMA_POR_TIPO: Readonly<Record<string, string>> = {
  playa: 'Playas y costa',
  parque: 'Parques caninos',
  ruta: 'Rutas y naturaleza',
  rio: 'Ríos y baños',
  restaurante: 'Comer con tu perro',
  tienda: 'Compras para tu perro',
};

/** Sin fechas, un plan de más de tres días deja de ser una escapada. */
const MAX_DIAS_SIN_FECHAS = 3;

const MS_DIA = 24 * 60 * 60 * 1000;

/** Días entre dos fechas, ambos incluidos y acotados; null si faltan o no cuadran. */
export function diasDelViaje(desde?: string, hasta?: string): number | null {
  if (!desde || !hasta) return null;
  const dias = Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_DIA) + 1;
  if (!Number.isFinite(dias) || dias < 1) return null;
  return Math.min(MAX_DIAS_ITINERARIO, dias);
}

/** Verticales que el viaje necesita reservar, en el orden en que se usan. */
export function verticalesBuscadas(preferencias: PreferenciasViaje): string[] {
  return [
    ...(preferencias.desplazamiento === DesplazamientoViaje.TRANSPORTE_MASCOTA ? [VerticalKey.TRANSPORTE] : []),
    ...(preferencias.alojamiento === AlojamientoViaje.NECESITO ? [VerticalKey.ALOJAMIENTO, VerticalKey.HOTELES] : []),
    ...preferencias.serviciosExtra,
  ];
}

export function paradaDeLugar(lugar: LugarContexto): ParadaItinerario {
  return {
    titulo: lugar.nombre,
    descripcion: lugar.descripcion || `${lugar.tipo} en ${lugar.ubicacion.ciudad}`,
    tipo: 'lugar',
    lugarId: String(lugar._id),
  };
}

export function paradaDeServicio(servicio: ServicioContexto): ParadaItinerario {
  return {
    titulo: servicio.titulo,
    descripcion: servicio.descripcion ?? '',
    tipo: 'servicio',
    servicioId: String(servicio._id),
    vertical: servicio.vertical,
    precioEstimado: servicio.precioBase,
  };
}

/** Alojamiento canino y, si no lo hay, hotel pet-friendly: la base del viaje. */
export function alojamientoDe(servicios: readonly ServicioContexto[]): ServicioContexto | undefined {
  return servicios.find((s) => s.vertical === VerticalKey.ALOJAMIENTO)
    ?? servicios.find((s) => s.vertical === VerticalKey.HOTELES);
}

/** Tipo de lugar más repetido del día, en la forma en que se lee en pantalla. */
function temaDe(lugares: readonly LugarContexto[]): string | null {
  if (!lugares.length) return null;
  const cuenta = new Map<string, number>();
  for (const lugar of lugares) cuenta.set(lugar.tipo, (cuenta.get(lugar.tipo) ?? 0) + 1);
  const dominante = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return TEMA_POR_TIPO[dominante] ?? null;
}

/**
 * Servicios que abren el día 1 y los que se reparten por el viaje.
 *
 * El transporte y el alojamiento van el primer día, porque es cuando se usan;
 * cada servicio extra pedido (peluquería, veterinario…) se reparte en un día
 * distinto; y si no se pidió ninguno, un servicio de la zona por día, como antes.
 */
function serviciosDelViaje(
  servicios: readonly ServicioContexto[], preferencias: PreferenciasViaje,
): { apertura: ServicioContexto[]; repartidos: ServicioContexto[] } {
  const transporte = preferencias.desplazamiento === DesplazamientoViaje.TRANSPORTE_MASCOTA
    ? servicios.find((s) => s.vertical === VerticalKey.TRANSPORTE) : undefined;
  const alojamiento = preferencias.alojamiento === AlojamientoViaje.NECESITO ? alojamientoDe(servicios) : undefined;
  const apertura = [transporte, alojamiento].filter((s): s is ServicioContexto => Boolean(s));

  const libres = servicios.filter((s) => !apertura.includes(s));
  const repartidos = preferencias.serviciosExtra.length
    ? preferencias.serviciosExtra
      .map((vertical) => libres.find((s) => s.vertical === vertical))
      .filter((s): s is ServicioContexto => Boolean(s))
    : libres.filter((s) => s.vertical !== VerticalKey.ALOJAMIENTO && s.vertical !== VerticalKey.HOTELES);
  return { apertura, repartidos };
}

/** Reparte los lugares en días según el ritmo y encabeza cada día con su tema. */
function diasConLugares(
  provincia: string, lugares: readonly LugarContexto[], preferencias: PreferenciasViaje,
): DiaItinerario[] {
  const porDia = PARADAS_POR_RITMO[preferencias.ritmo];
  const total = preferencias.dias ?? (Math.min(MAX_DIAS_SIN_FECHAS, Math.ceil(lugares.length / porDia)) || 1);

  return Array.from({ length: total }, (_, i) => {
    const delDia = lugares.slice(i * porDia, (i + 1) * porDia);
    return {
      dia: i + 1,
      titulo: `Día ${i + 1} · ${temaDe(delDia) ?? provincia}`,
      paradas: delDia.map(paradaDeLugar),
    };
  });
}

/**
 * Itinerario sin modelo: lugares repartidos por días según el ritmo y los
 * servicios que el viaje necesita, siempre con al menos uno reservable.
 */
export function armarDias(
  provincia: string,
  lugares: readonly LugarContexto[],
  servicios: readonly ServicioContexto[],
  preferencias: PreferenciasViaje,
): DiaItinerario[] {
  const dias = diasConLugares(provincia, lugares, preferencias);
  const { apertura, repartidos } = serviciosDelViaje(servicios, preferencias);

  dias[0].paradas.unshift(...apertura.map(paradaDeServicio));
  repartidos
    .slice(0, preferencias.serviciosExtra.length ? repartidos.length : dias.length)
    .forEach((servicio, i) => dias[i % dias.length].paradas.push(paradaDeServicio(servicio)));

  return garantizarServicio(dias, servicios, preferencias);
}

/**
 * Si ningún día trae nada reservable, se añade el servicio que mejor encaja al
 * primer día. Un plan que no acaba en una reserva no lleva a ningún sitio: es
 * lo que el cliente pidió corregir.
 */
export function garantizarServicio(
  dias: DiaItinerario[], servicios: readonly ServicioContexto[], preferencias: PreferenciasViaje,
): DiaItinerario[] {
  const tieneServicio = dias.some((d) => d.paradas.some((p) => p.servicioId));
  if (tieneServicio || !servicios.length) return dias;

  const buscadas = verticalesBuscadas(preferencias);
  const preferido = buscadas.map((v) => servicios.find((s) => s.vertical === v)).find(Boolean) ?? servicios[0];
  const conDia = dias.length ? dias : [{ dia: 1, titulo: 'Día 1', paradas: [] }];
  conDia[0] = { ...conDia[0], paradas: [...conDia[0].paradas, paradaDeServicio(preferido)] };
  return conDia;
}

/** Lo que costaría el viaje: el alojamiento por noche más el resto de servicios. */
export function presupuestoDe(dias: readonly DiaItinerario[]): number {
  const servicios = dias.flatMap((d) => d.paradas).filter((p) => p.servicioId);
  const noches = Math.max(1, dias.length - 1);
  return Math.round(servicios.reduce((suma, p) => {
    const esAlojamiento = p.vertical === VerticalKey.ALOJAMIENTO || p.vertical === VerticalKey.HOTELES;
    return suma + (p.precioEstimado ?? 0) * (esAlojamiento ? noches : 1);
  }, 0));
}

/**
 * Lo que se ofrece reservar al final del plan, sin repetir: todo lo reservable
 * de las opciones y, si no hubiera nada, los mejores servicios de la zona.
 */
export function serviciosSugeridos(
  opciones: readonly OpcionItinerario[], servicios: readonly ServicioContexto[], maximo = 6,
): ParadaItinerario[] {
  const vistas = new Map<string, ParadaItinerario>();
  for (const parada of opciones.flatMap((o) => o.dias.flatMap((d) => d.paradas))) {
    if (parada.servicioId && !vistas.has(parada.servicioId)) vistas.set(parada.servicioId, parada);
  }
  const sugeridas = vistas.size ? [...vistas.values()] : servicios.map(paradaDeServicio);
  return sugeridas.slice(0, maximo);
}
