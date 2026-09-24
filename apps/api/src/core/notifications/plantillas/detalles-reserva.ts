/**
 * Detalles de `reserva.detalle` que merece la pena enseñar al cliente, con su
 * etiqueta. Lo que no está aquí (flags internos, textos del cuestionario) no se
 * vuelca en el correo: es un comprobante, no un volcado del formulario.
 */
const ETIQUETAS: ReadonlyArray<readonly [string, string, ((v: unknown) => string)?]> = [
  ['servicio', 'Servicio'],
  ['servicioNombre', 'Servicio'],
  ['tamanoPerro', 'Tamaño del perro'],
  ['modalidad', 'Modalidad', (v) => (v === 'programa' ? 'Programa completo' : v === 'sesion' ? 'Sesión' : String(v))],
  ['origen', 'Recogida'],
  ['destino', 'Destino'],
  ['lugarRecogida', 'Lugar de recogida'],
  ['direccionRecogida', 'Dirección de recogida'],
  ['distanciaKm', 'Distancia', (v) => `${v} km`],
  ['franja', 'Franja', (v) => ({ manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' } as Record<string, string>)[String(v)] ?? String(v)],
  ['extras', 'Extras', (v) => (Array.isArray(v) ? v.map(nombreDeExtra).filter(Boolean).join(', ') : String(v))],
  ['observaciones', 'Observaciones'],
];

export function detallesLegibles(detalle: Record<string, unknown> | undefined): Array<[string, string]> {
  if (!detalle) return [];
  // Transporte deja escrito su propio resumen («Recogida», «Mascotas»…): es lo
  // que el cliente revisó antes de pagar y lo que tiene que leer el conductor.
  const resumen = detalle['resumen'];
  if (Array.isArray(resumen)) {
    return resumen
      .filter((fila): fila is [unknown, unknown] => Array.isArray(fila) && fila.length === 2)
      .map(([etiqueta, valor]) => [String(etiqueta), String(valor)]);
  }
  const vistos = new Set<string>();
  const filas: Array<[string, string]> = [];
  for (const [clave, etiqueta, formato] of ETIQUETAS) {
    const valor = detalle[clave];
    if (valor === undefined || valor === null || valor === '' || (Array.isArray(valor) && !valor.length)) continue;
    const texto = formato ? formato(valor) : String(valor);
    if (!texto.trim() || vistos.has(etiqueta)) continue;
    vistos.add(etiqueta);
    filas.push([etiqueta, texto]);
  }
  return filas;
}

/** Un extra puede llegar como texto o como objeto con nombre; un hueco vacío no se enseña. */
function nombreDeExtra(extra: unknown): string {
  if (extra === null || extra === undefined) return '';
  if (typeof extra === 'object') return String((extra as { nombre?: string }).nombre ?? '');
  return String(extra);
}
