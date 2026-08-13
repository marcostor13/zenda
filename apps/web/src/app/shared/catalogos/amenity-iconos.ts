import type { CardAmenity } from '../components/card/rs-card.component';

/**
 * Traduce el texto de una etiqueta de servicio al icono Lucide que le
 * corresponde, para que la misma etiqueta se vea igual en todos los listados.
 *
 * Se busca por palabra clave y no por igualdad exacta a propósito: las
 * etiquetas de los comercios son texto libre (`AMENITIES_ALOJAMIENTO` es una
 * lista de sugerencias, no cerrada), y varias se redactan de formas distintas
 * — "Cámaras 24 h", "Cámaras 24h", "Cámara individual". Lo que no se reconoce
 * cae en `check`, que sirve para cualquier servicio incluido.
 */

/** Icono con el que se pinta una etiqueta que no encaja en ninguna regla. */
const ICONO_POR_DEFECTO = 'check';

/**
 * Reglas por palabra clave, en orden de prioridad: gana la primera que
 * aparezca en el texto. Las más específicas van antes que las genéricas
 * ("veterinario" antes que "medicación", "urgencia" antes que "hora").
 */
const REGLAS: ReadonlyArray<readonly [palabras: readonly string[], icono: string]> = [
  [['urgencia', '24 h', '24h', '24/7'], 'clock'],
  [['veterinario', 'veterinaria', 'clinica'], 'stethoscope'],
  [['camara'], 'video'],
  [['piscina'], 'waves'],
  [['jardin', 'patio', 'exterior', 'parque'], 'leaf'],
  [['paseo', 'correa'], 'bone'],
  [['juego', 'juguete', 'socializa'], 'party-popper'],
  [['cachorro', 'perro', 'mascota', 'raza'], 'paw'],
  [['aire', 'calefaccion', 'climatiza', 'suelo radiante'], 'droplet'],
  [['alimentacion', 'comida', 'nutricion'], 'utensils'],
  [['medicacion', 'vacuna', 'desparasita'], 'pill'],
  [['recogida', 'domicilio', 'traslado', 'transporte'], 'car'],
  [['cama', 'manta', 'descanso', 'suite', 'habitacion'], 'hotel'],
  [['informe', 'foto'], 'camera'],
  [['adiestrador', 'obediencia', 'entrenamiento'], 'graduation-cap'],
  [['cancelacion', 'gratis', 'sin coste'], 'badge-check'],
  [['seguro', 'cobertura', 'poliza'], 'shield-check'],
  [['zona', 'cubre', 'ciudad', 'ubicacion'], 'map-pin'],
  [['precio', 'euro', 'pago', 'desde'], 'euro'],
  [['horario', 'cita', 'sesion', 'minuto', 'mes'], 'calendar'],
];

/** Quita tildes y pasa a minúsculas para que "Jardín" case con "jardin". */
const normalizar = (texto: string): string =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Icono Lucide para el texto de una etiqueta de servicio. */
export function iconoDeEtiqueta(etiqueta: string): string {
  const texto = normalizar(etiqueta);
  for (const [palabras, icono] of REGLAS) {
    if (palabras.some((palabra) => texto.includes(palabra))) return icono;
  }
  return ICONO_POR_DEFECTO;
}

/**
 * Convierte etiquetas sueltas en las que espera `<rs-card>`, asignándole a
 * cada una su icono. Las que ya vienen con icono se respetan tal cual.
 */
export function conIconos(etiquetas: readonly CardAmenity[]): CardAmenity[] {
  return etiquetas.map((etiqueta) =>
    typeof etiqueta === 'string'
      ? { icon: iconoDeEtiqueta(etiqueta), label: etiqueta }
      : etiqueta,
  );
}
