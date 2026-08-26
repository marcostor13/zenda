/** Unidad reservable de un servicio: un espacio de una residencia, una habitación… */
export interface UnidadReservable {
  id?: string;
  cantidad: number;
}

export interface UnidadLocalizada<T> {
  unidad: T;
  /** El id con el que el cliente se refiere a esta unidad. */
  idPublico: string;
}

/**
 * Id público de una unidad reservable.
 *
 * Los subdocumentos de `espacios` se guardan con `_id: false`, así que casi
 * ninguno tiene id propio. El catálogo sintetiza uno por posición (`esp-0`,
 * `esp-1`…) para que el cliente pueda elegir, pero **ese id no se persiste**:
 * si el lado de la reserva busca por `espacio.id` nunca encuentra nada, el
 * alojamiento parece no tener ningún espacio publicado y todas las fechas
 * salen sin plaza. Las dos partes tienen que calcular el id igual, y por eso
 * vive aquí y no duplicado en cada una.
 */
export const idDeUnidad = (unidad: UnidadReservable & { _id?: unknown }, indice: number): string =>
  String(unidad.id ?? unidad._id ?? `esp-${indice}`);

/**
 * Localiza la unidad que pide el cliente. Sin `espacioId` devuelve la primera
 * con cupo, que es el comportamiento de un servicio con una sola unidad.
 */
export const localizarUnidad = <T extends UnidadReservable>(
  unidades: readonly T[],
  espacioId?: string,
): UnidadLocalizada<T> | undefined => {
  const indice = espacioId
    ? unidades.findIndex((unidad, i) => idDeUnidad(unidad, i) === espacioId)
    : unidades.findIndex((unidad) => unidad.cantidad > 0);

  if (indice === -1) return undefined;
  return { unidad: unidades[indice], idPublico: idDeUnidad(unidades[indice], indice) };
};
