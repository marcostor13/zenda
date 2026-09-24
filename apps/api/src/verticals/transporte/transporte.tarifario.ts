import {
  EspecieMascota, ModalidadTransporte, ModoPrecioTransporte, PoliticaCancelacionTransporte,
  PreferenciaTransporte, TarifarioTransporte,
} from 'shared';
import { Transporte } from './transporte.schema';

/** Gratis hasta un día antes: lo que ya prometía la ficha de ejemplo del cliente. */
export const CANCELACION_POR_DEFECTO: PoliticaCancelacionTransporte = {
  gratisHastaHoras: 24,
  reembolsoTardioPct: 0,
};

/** Cómo se llamaban en las fichas antiguas las características que ahora son incluidos. */
const CARACTERISTICA_A_INCLUIDO: Record<string, PreferenciaTransporte> = {
  climatizacion: PreferenciaTransporte.CLIMATIZACION,
  gps: PreferenciaTransporte.SEGUIMIENTO,
  seguimiento_gps: PreferenciaTransporte.SEGUIMIENTO,
  puerta_a_puerta: PreferenciaTransporte.PUERTA_A_PUERTA,
};

/**
 * El tarifario que entiende el cotizador, a partir del documento guardado.
 *
 * Las fichas dadas de alta antes del flujo nuevo no tienen modalidades,
 * especies ni incluidos. En vez de migrarlas en bloque —y arriesgar pisar algo
 * que el comercio editó a la vez—, se deducen aquí de los campos que sí tenían.
 * En cuanto el comercio guarda el formulario nuevo, manda lo que declaró.
 */
export function tarifarioDe(t: Partial<Transporte>): TarifarioTransporte {
  return {
    modoPrecio: t.modoPrecio ?? ModoPrecioTransporte.POR_KM,
    tarifaBase: t.tarifaBase ?? 0,
    tarifaKm: t.tarifaKm ?? 0,
    precioFijo: t.precioFijo,
    zonasPrecio: t.zonasPrecio,
    distanciaMinimaKm: t.distanciaMinimaKm,
    tarifaEsperaPorHora: t.tarifaEsperaPorHora,
    modalidades: modalidadesDe(t),
    precioExclusivo: t.precioExclusivo,
    suplementos: t.suplementos,
    capacidadPerros: t.capacidadPerros ?? 1,
    maxPerrosPorTrayecto: t.maxPerrosPorTrayecto,
    plazasPasajeros: t.plazasPasajeros ?? 0,
    especiesAceptadas: especiesDe(t),
    aceptaLoAntesPosible: t.aceptaLoAntesPosible,
    aceptaUrgentes: t.aceptaUrgentes,
    antelacionMinimaHoras: t.antelacionMinimaHoras,
    reglasPresupuesto: t.reglasPresupuesto,
  };
}

export function modalidadesDe(t: Partial<Transporte>): ModalidadTransporte[] {
  if (t.modalidades?.length) return t.modalidades;

  const tipos = t.tiposTransporteOfrecidos ?? [];
  // Quien sólo declaró «exclusivo» no hace viajes compartidos.
  const soloExclusivo = tipos.includes('exclusivo') && !tipos.includes('compartido');
  const modalidades = soloExclusivo ? [] : [ModalidadTransporte.COMPARTIDO];
  if (tipos.includes('exclusivo') || t.precioExclusivo != null) modalidades.push(ModalidadTransporte.EXCLUSIVO);
  if ((t.plazasPasajeros ?? 0) > 0) modalidades.push(ModalidadTransporte.CON_PROPIETARIO);
  return modalidades;
}

export function especiesDe(t: Partial<Transporte>): string[] {
  if (t.especiesAceptadas?.length) return t.especiesAceptadas;
  return t.soloPerros === false
    ? [EspecieMascota.PERRO, EspecieMascota.GATO]
    : [EspecieMascota.PERRO];
}

export function incluidosDe(t: Partial<Transporte>): PreferenciaTransporte[] {
  if (t.incluidos?.length) return t.incluidos;

  const deducidos = new Set<PreferenciaTransporte>();
  for (const caracteristica of t.caracteristicasVehiculo ?? []) {
    const incluido = CARACTERISTICA_A_INCLUIDO[caracteristica];
    if (incluido) deducidos.add(incluido);
  }
  if (t.tipoVehiculo === 'furgon_climatizado') deducidos.add(PreferenciaTransporte.CLIMATIZACION);
  if (t.jaulasIncluidas) deducidos.add(PreferenciaTransporte.TRANSPORTIN_INCLUIDO);
  return [...deducidos];
}

export function cancelacionDe(t: Partial<Transporte>): PoliticaCancelacionTransporte {
  return {
    gratisHastaHoras: t.cancelacion?.gratisHastaHoras ?? CANCELACION_POR_DEFECTO.gratisHastaHoras,
    reembolsoTardioPct: t.cancelacion?.reembolsoTardioPct ?? CANCELACION_POR_DEFECTO.reembolsoTardioPct,
  };
}
