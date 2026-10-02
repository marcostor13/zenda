/**
 * Precio «desde» de un servicio: el del producto más barato que de verdad se
 * puede reservar en su ficha.
 *
 * Antes cada pantalla sacaba el suyo: el listado enseñaba `precioBase` —un
 * «precio orientativo» que el comercio escribe a mano—, la ficha el del espacio
 * o servicio concreto y el asistente el que viajaba en la URL. El cliente veía
 * 25 € en la tarjeta y 32 € al entrar. La regla vive aquí para que el API (que
 * la usa al guardar y al devolver la tarjeta) y la web digan lo mismo.
 *
 * Los importes llevan el IVA incluido, igual que todos los precios declarados
 * por el comercio: no se suma nada encima.
 */

/** Lo mínimo que hace falta del servicio: su categoría, su precio base y los campos propios. */
export interface ServicioConPrecio {
  readonly vertical?: string | null;
  readonly precioBase?: number | null;
  readonly extra?: Readonly<Record<string, unknown>> | null;
}

type Item = Readonly<Record<string, unknown>>;

const lista = (valor: unknown): Item[] =>
  Array.isArray(valor) ? valor.filter((v): v is Item => !!v && typeof v === 'object') : [];

const importe = (valor: unknown): number | undefined =>
  typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : undefined;

const activo = (item: Item): boolean => item['activo'] !== false;

/** Precios candidatos de cada categoría; el «desde» es el menor. */
const CANDIDATOS: Readonly<Record<string, (extra: Item) => Array<number | undefined>>> = {
  // Todos los espacios, también los agotados: la ficha los enseña con su
  // precio y el «desde» tiene que coincidir con el más barato de esa lista.
  alojamiento: (e) => lista(e['espacios']).map((esp) => importe(esp['precioNoche'])),
  hoteles: (e) => lista(e['espacios']).map((esp) => importe(esp['precioNoche'])),
  veterinaria: (e) => [
    importe(e['precioConsulta']),
    ...lista(e['serviciosClinicos']).filter(activo).map((s) => importe(s['precio'])),
  ],
  peluqueria: (e) => lista(e['serviciosGrooming']).filter(activo).map((s) => importe(s['precio'])),
  adiestramiento: (e) => [
    importe(e['precioSesion']),
    ...lista(e['serviciosAdiestramiento']).filter(activo).map((s) => importe(s['precio'])),
  ],
  funerarios: (e) => lista(e['serviciosFunerarios']).filter(activo).flatMap((s) => [
    importe(s['precioBase']),
    ...lista(s['tramosPeso']).map((t) => importe(t['precio'])),
  ]),
  seguros: (e) => [importe(e['primaAnualBase'])],
  transporte: (e) => [importe(e['precioDesde']) ?? importe(e['tarifaBase'])],
};

/**
 * El «desde» del servicio. Si la categoría no tiene productos con precio (o el
 * comercio aún no los ha rellenado) se queda con `precioBase`, que es lo único
 * que hay. Es idempotente: aplicarlo sobre una tarjeta que ya lo trae calculado
 * devuelve lo mismo.
 */
export function precioDesdeServicio(servicio: ServicioConPrecio): number {
  const base = importe(servicio.precioBase) ?? 0;
  const candidatos = CANDIDATOS[servicio.vertical ?? '']?.(servicio.extra ?? {}) ?? [];
  const precios = candidatos.filter((p): p is number => p !== undefined);
  return precios.length ? Math.min(...precios) : base;
}
