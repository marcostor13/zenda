export type ClavePoliticaCancelacion = 'flexible' | 'moderada' | 'estricta';

export interface PoliticaCancelacion {
  readonly valor: ClavePoliticaCancelacion;
  readonly label: string;
  /** Frase completa: lo que lee el comercio al elegir y el cliente al reservar. */
  readonly descripcion: string;
  /** La misma condición abreviada, para tablas y listados. */
  readonly resumen: string;
}

/**
 * Políticas de cancelación que un comercio puede declarar en su servicio.
 *
 * La plataforma no calcula el reembolso a partir de esto: la política es un
 * compromiso del comercio y una promesa que el cliente lee antes de reservar.
 * Por eso el texto vive en un único sitio — lo que el comercio elige en su
 * formulario y lo que el admin ve en la ficha de la reserva tienen que decir
 * exactamente lo mismo.
 */
export const POLITICAS_CANCELACION: ReadonlyArray<PoliticaCancelacion> = [
  {
    valor: 'flexible',
    label: 'Flexible',
    descripcion: 'El cliente cancela gratis hasta 24 h antes y recupera el importe íntegro. Atrae más reservas, pero deja menos margen para cubrir un hueco de última hora.',
    resumen: 'cancelación gratuita hasta 24 h antes',
  },
  {
    valor: 'moderada',
    label: 'Moderada',
    descripcion: 'El cliente cancela gratis hasta 3 días antes. Es el equilibrio habitual: da margen para revender la plaza sin espantar reservas.',
    resumen: 'cancelación gratuita hasta 3 días antes',
  },
  {
    valor: 'estricta',
    label: 'Estricta',
    descripcion: 'No hay devolución al cancelar. Protege tu agenda en servicios difíciles de reocupar, pero resta reservas frente a comercios más flexibles.',
    resumen: 'sin devolución al cancelar',
  },
];

/**
 * La condición completa, para la ficha que lee el cliente antes de reservar.
 *
 * `describirPolitica` da el rótulo corto de una tabla; esto es la frase que
 * explica qué pasa si cancela. Sin ella la ficha pintaba la clave en crudo
 * —"flexible"—, que no le dice nada a quien está a punto de pagar.
 */
export function descripcionPolitica(valor: string | undefined | null): string {
  if (!valor) return 'Consulta las condiciones de cancelación con el alojamiento.';

  const politica = POLITICAS_CANCELACION.find((p) => p.valor === valor);
  // Un comercio antiguo pudo guardar texto libre; se muestra tal cual.
  return politica ? politica.descripcion : valor;
}

/** La política en palabras: `Flexible · cancelación gratuita hasta 24 h antes`. */
export function describirPolitica(valor: string | undefined | null): string {
  if (!valor) return '—';

  const politica = POLITICAS_CANCELACION.find((p) => p.valor === valor);
  // Un comercio antiguo pudo guardar texto libre; se muestra tal cual.
  return politica ? `${politica.label} · ${politica.resumen}` : valor;
}
